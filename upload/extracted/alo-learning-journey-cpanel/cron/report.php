<?php
require dirname(__DIR__).'/app/services.php';
$token=(string)envv('TELEGRAM_BOT_TOKEN');$chat=(string)envv('TELEGRAM_ADMIN_CHAT_ID');
if($token&&$chat){$s=analytics_summary();curl_json("https://api.telegram.org/bot{$token}/sendMessage",['chat_id'=>$chat,'text'=>"ALO Daily Report\n".json_encode($s,JSON_UNESCAPED_UNICODE)]);}
echo "ok\n";
