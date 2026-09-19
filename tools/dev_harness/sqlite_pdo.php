<?php
declare(strict_types=1);
// SQLite stand-in for the app's MySQL PDO, used only by the dev harness.
// Translates the handful of MySQL-isms the API uses at prepare/exec time, so
// the real api/*.php files run unmodified apart from get_db().

final class HarnessPDO extends PDO
{
    // ON DUPLICATE KEY needs an explicit conflict target in SQLite.
    private const CONFLICT_TARGETS = [
        'user_data' => 'user_id, resource_key',
        'workout_sessions' => 'id',
        'workout_activities' => 'id',
        'workout_templates' => 'id',
    ];

    public static function translate(string $sql): string
    {
        $sql = preg_replace_callback(
            '/DATE_ADD\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+(\w+)\s*\)/i',
            function ($m) {
                $unit = strtolower($m[2]);
                if (!str_ends_with($unit, 's')) $unit .= 's';
                return "datetime('now','+{$m[1]} {$unit}')";
            },
            $sql
        );
        $sql = preg_replace('/\bNOW\(\)/i', "datetime('now')", $sql);
        $sql = preg_replace('/\s+FOR\s+UPDATE\b/i', '', $sql);
        $sql = str_replace('<=>', ' IS ', $sql); // MySQL null-safe equals
        if (preg_match('/ON\s+DUPLICATE\s+KEY\s+UPDATE/i', $sql)) {
            if (!preg_match('/INSERT\s+INTO\s+(\w+)/i', $sql, $t) || !isset(self::CONFLICT_TARGETS[$t[1]])) {
                throw new RuntimeException('dev harness: add a CONFLICT_TARGETS entry for this ON DUPLICATE KEY UPDATE');
            }
            $sql = preg_replace('/ON\s+DUPLICATE\s+KEY\s+UPDATE/i', 'ON CONFLICT(' . self::CONFLICT_TARGETS[$t[1]] . ') DO UPDATE SET', $sql);
            $sql = preg_replace('/VALUES\((\w+)\)/i', 'excluded.$1', $sql);
        }
        return $sql;
    }

    #[\ReturnTypeWillChange]
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return parent::prepare(self::translate($query), $options);
    }

    #[\ReturnTypeWillChange]
    public function query(string $query, ?int $fetchMode = null, mixed ...$args): PDOStatement|false
    {
        $query = self::translate($query);
        return $fetchMode === null ? parent::query($query) : parent::query($query, $fetchMode, ...$args);
    }

    #[\ReturnTypeWillChange]
    public function exec(string $statement): int|false
    {
        return parent::exec(self::translate($statement));
    }
}

function harness_open(string $file): HarnessPDO
{
    $pdo = new HarnessPDO('sqlite:' . $file, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys=ON');
    return $pdo;
}

// Splits a SQL script into statements, ignoring ';' inside '...' strings and
// -- line comments.
function harness_split_sql(string $sql): array
{
    $out = [];
    $buf = '';
    $inStr = false;
    $n = strlen($sql);
    for ($i = 0; $i < $n; $i++) {
        $c = $sql[$i];
        if ($inStr) {
            $buf .= $c;
            if ($c === "'") {
                if ($i + 1 < $n && $sql[$i + 1] === "'") {
                    $buf .= "'";
                    $i++;
                } else {
                    $inStr = false;
                }
            }
            continue;
        }
        if ($c === '-' && $i + 1 < $n && $sql[$i + 1] === '-') {
            while ($i < $n && $sql[$i] !== "\n") $i++;
            $buf .= "\n";
            continue;
        }
        if ($c === "'") {
            $inStr = true;
            $buf .= $c;
            continue;
        }
        if ($c === ';') {
            if (trim($buf) !== '') $out[] = trim($buf);
            $buf = '';
            continue;
        }
        $buf .= $c;
    }
    if (trim($buf) !== '') $out[] = trim($buf);
    return $out;
}

// MySQL DDL/DML -> SQLite, for db/schema.sql, db/migrations/*.sql and the seed.
function harness_ddl(string $stmt): array
{
    if (preg_match('/^INSERT\s+(IGNORE\s+)?INTO/i', $stmt)) {
        return [preg_replace('/^INSERT\s+IGNORE/i', 'INSERT OR IGNORE', $stmt)];
    }
    // ALTER TABLE t ADD COLUMN a ..., ADD COLUMN b ...  ->  one statement each.
    if (preg_match('/^ALTER\s+TABLE\s+(\w+)\s+(.*)$/is', $stmt, $m)) {
        $out = [];
        foreach (preg_split('/,\s*(?=ADD\s+COLUMN)/i', $m[2]) as $part) {
            $part = trim($part);
            $unique = false;
            if (preg_match('/\s+UNIQUE\b/i', $part)) {
                $unique = true;
                $part = preg_replace('/\s+UNIQUE\b/i', '', $part);
            }
            $out[] = "ALTER TABLE {$m[1]} " . $part;
            if ($unique && preg_match('/ADD\s+COLUMN\s+(\w+)/i', $part, $c)) {
                $out[] = "CREATE UNIQUE INDEX IF NOT EXISTS uq_{$m[1]}_{$c[1]} ON {$m[1]}({$c[1]})";
            }
        }
        return $out;
    }
    if (preg_match('/^CREATE\s+TABLE/i', $stmt)) {
        $stmt = preg_replace('/\)\s*ENGINE=.*$/is', ')', $stmt);
        $stmt = preg_replace('/\b(?:BIGINT|INT|SMALLINT|TINYINT)\s+UNSIGNED\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/i', 'INTEGER PRIMARY KEY AUTOINCREMENT', $stmt);
        $stmt = preg_replace('/\s+UNSIGNED\b/i', '', $stmt);
        $stmt = preg_replace('/\bCONSTRAINT\s+\w+\s+(FOREIGN\s+KEY)/i', '$1', $stmt);
        $stmt = preg_replace('/UNIQUE\s+KEY\s+\w+\s*\(/i', 'UNIQUE (', $stmt);
        // Plain secondary KEY definitions are just indexes; drop them.
        $stmt = preg_replace('/,\s*KEY\s+\w+\s*\([^)]*\)/i', '', $stmt);
        $stmt = preg_replace('/\bLONGTEXT\b/i', 'TEXT', $stmt);
        return [$stmt];
    }
    return [$stmt]; // CREATE INDEX etc. are portable
}
