<?php
require dirname(__DIR__).'/app/bootstrap.php';
$key=$_GET['key']??'';
if(!hash_equals((string)envv('ADMIN_SETUP_KEY'),(string)$key)){http_response_code(403);exit('Invalid setup key');}
$msg='';
if($_SERVER['REQUEST_METHOD']==='POST'){
    $sql=file_get_contents(__DIR__.'/schema.sql');
    foreach(array_filter(array_map('trim',preg_split('/;\s*(?:\r?\n|$)/',$sql))) as $q)db()->exec($q);
    $name=trim($_POST['name']??'Administrator');$email=trim($_POST['email']??'');$password=(string)($_POST['password']??'');
    if(!$email||strlen($password)<12)exit('Email required and password must be at least 12 characters.');
    db()->prepare("INSERT INTO admins(name,email,password_hash) VALUES(?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),password_hash=VALUES(password_hash)")->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT)]);
    $msg='Installed. Delete or block /install now.';
}
echo "<!doctype html><html><body style='font-family:sans-serif;max-width:520px;margin:50px auto'><h1>ALO Learning Journey Installer</h1><p>{$msg}</p><form method='post'><p><input name='name' placeholder='Admin name' required style='padding:10px;width:100%'></p><p><input name='email' type='email' placeholder='Admin email' required style='padding:10px;width:100%'></p><p><input name='password' type='password' placeholder='Strong password (12+)' required style='padding:10px;width:100%'></p><button style='padding:12px'>Install</button></form></body></html>";
