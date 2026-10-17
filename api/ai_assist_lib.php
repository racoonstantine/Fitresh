<?php
declare(strict_types=1);

// Pure helpers for api/ai_assist.php (kept separate so tools/test_ai_assist.php can load them
// without a database or network): request validation, the OpenAI request body, reply extraction.
// Photos only ever exist in memory for the length of one request; nothing here writes them anywhere.

const AI_MAX_PROMPT_CHARS = 8000;
const AI_MAX_IMAGE_BYTES = 2500000; // decoded; the app sends a ~1024px JPEG (about 100-250 KB)

// Returns [prompt, imageDataUrl|null] or throws InvalidArgumentException with a user-safe message.
function ai_validate_request(array $input): array
{
    $prompt = trim((string)($input['prompt'] ?? ''));
    if ($prompt === '') {
        throw new InvalidArgumentException('Nothing to send to the AI.');
    }
    if (strlen($prompt) > AI_MAX_PROMPT_CHARS) {
        throw new InvalidArgumentException('That description is too long.');
    }
    $image = $input['image'] ?? null;
    if ($image === null || $image === '') {
        return [$prompt, null];
    }
    if (!is_string($image) || !preg_match('#^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$#', $image, $m)) {
        throw new InvalidArgumentException('That photo could not be read. Try a different one.');
    }
    $bytes = base64_decode($m[2], true);
    if ($bytes === false || $bytes === '' || strlen($bytes) > AI_MAX_IMAGE_BYTES) {
        throw new InvalidArgumentException('That photo is too large. Try a smaller one.');
    }
    // Trust the bytes, not the label the client chose.
    $magic = [
        'image/jpeg' => "\xFF\xD8\xFF",
        'image/png' => "\x89PNG",
        'image/webp' => 'RIFF',
    ];
    if (strncmp($bytes, $magic[$m[1]], strlen($magic[$m[1]])) !== 0) {
        throw new InvalidArgumentException('That photo could not be read. Try a different one.');
    }
    return [$prompt, $image];
}

function ai_build_openai_body(string $prompt, ?string $imageDataUrl, string $model): array
{
    $content = [['type' => 'text', 'text' => $prompt]];
    if ($imageDataUrl !== null) {
        $content[] = ['type' => 'image_url', 'image_url' => ['url' => $imageDataUrl, 'detail' => 'auto']];
    }
    return [
        'model' => $model,
        'temperature' => 0.2,
        'max_tokens' => 900,
        'store' => false,
        'messages' => [
            ['role' => 'system', 'content' => 'You are the estimation engine inside a personal fitness tracker. '
                . 'Follow the requested reply format exactly and add no commentary. Give your best numeric estimates.'],
            ['role' => 'user', 'content' => $content],
        ],
    ];
}

// Returns the reply text, or null when the response has no usable answer.
function ai_extract_reply(array $response): ?string
{
    $text = $response['choices'][0]['message']['content'] ?? null;
    if (!is_string($text) || trim($text) === '') {
        return null;
    }
    return trim($text);
}

// Real transport: one HTTPS call to OpenAI. Returns [httpStatus, decodedJson|null]. Never echoes the key.
function ai_openai_transport(string $apiKey, array $body, string $baseUrl = 'https://api.openai.com/v1'): array
{
    $ch = curl_init(rtrim($baseUrl, '/') . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $apiKey],
        CURLOPT_POSTFIELDS => json_encode($body),
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$status, is_string($raw) ? json_decode($raw, true) : null];
}
