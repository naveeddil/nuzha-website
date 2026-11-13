<?php
declare(strict_types=1);

// Copy this file to config.php and replace every CHANGE_ME value.
// Keep config.php private and never email or commit it.
return [
    'db_host' => 'localhost',
    'db_name' => 'CHANGE_ME_DATABASE',
    'db_user' => 'CHANGE_ME_USER',
    'db_pass' => 'CHANGE_ME_PASSWORD',
    // Generate at least 32 random characters. Required only for first account setup.
    'setup_token' => 'CHANGE_ME_TO_A_LONG_RANDOM_SETUP_TOKEN',
    'session_name' => 'nuzha_secure_admin',
    'max_upload_bytes' => 8 * 1024 * 1024,
];
