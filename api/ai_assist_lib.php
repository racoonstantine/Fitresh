<?php
declare(strict_types=1);

// Pure helpers for api/ai_assist.php (kept separate so tools/test_ai_assist.php can load them
// without a database or network): request validation, the OpenAI request body, reply extraction.
// Photos only ever exist in memory for the length of one request; nothing here writes them anywhere.

const AI_MAX_PROMPT_CHARS = 8000;
const AI_MAX_IMAGES = 5;
const AI_MAX_IMAGE_BYTES = 2500000; // each, decoded; the app sends ~1024px JPEGs (about 100-250 KB)

// Returns [prompt, list of image data URLs (0 to 5)] or throws InvalidArgumentException with a user-safe message.
// Accepts 'images' (array) or the older single 'image'.
function ai_validate_request(array $input): array
{
    $prompt = trim((string)($input['prompt'] ?? ''));
    if ($prompt === '') {
        throw new InvalidArgumentException('Nothing to send to the AI.');
    }
    if (strlen($prompt) > AI_MAX_PROMPT_CHARS) {
        throw new InvalidArgumentException('That description is too long.');
    }
    $raw = $input['images'] ?? [];
    if (!is_array($raw)) {
        throw new InvalidArgumentException('Those photos could not be read. Try different ones.');
    }
    if (!empty($input['image'])) {
        $raw[] = $input['image'];
    }
    $raw = array_values(array_filter($raw, fn($v) => $v !== null && $v !== ''));
    if (count($raw) > AI_MAX_IMAGES) {
        throw new InvalidArgumentException('Up to ' . AI_MAX_IMAGES . ' photos at a time.');
    }
    $images = [];
    foreach ($raw as $image) {
        $images[] = ai_validate_image($image);
    }
    return [$prompt, $images];
}

function ai_validate_image($image): string
{
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
    return $image;
}

// $kind 'review' is Resh's progress review: text only, warmer voice, a little more room to write.
function ai_build_openai_body(string $prompt, array $imageDataUrls, string $model, string $kind = 'estimate'): array
{
    $review = $kind === 'review';
    $content = [['type' => 'text', 'text' => $prompt]];
    foreach ($imageDataUrls as $url) {
        $content[] = ['type' => 'image_url', 'image_url' => ['url' => $url, 'detail' => 'auto']];
    }
    return [
        'model' => $model,
        'temperature' => $review ? 0.6 : 0.2,
        'max_tokens' => $review ? 1100 : 900,
        'store' => false,
        'messages' => [
            ['role' => 'system', 'content' => $review
                ? 'You are Resh, a warm, upbeat but honest companion inside a personal fitness tracker. Use only the data you are given, '
                    . 'never invent numbers, and never diagnose or give medical advice. Follow the requested reply format exactly.'
                : 'You are the estimation engine inside a personal fitness tracker. '
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

// Seconds to wait for OpenAI: 45 for text, 10 more per photo, never over 75. Photos take the model longer,
// and the browser gives up at 90 s, so the server should answer (even with an error) before that.
function ai_openai_timeout(int $imageCount): int
{
    return min(75, 45 + 10 * max(0, $imageCount));
}

// Real transport: one HTTPS call to OpenAI. Returns [httpStatus, decodedJson|null]. Never echoes the key.
function ai_openai_transport(string $apiKey, array $body, string $baseUrl = 'https://api.openai.com/v1', int $timeout = 45): array
{
    $ch = curl_init(rtrim($baseUrl, '/') . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $apiKey],
        CURLOPT_POSTFIELDS => json_encode($body),
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$status, is_string($raw) ? json_decode($raw, true) : null];
}
