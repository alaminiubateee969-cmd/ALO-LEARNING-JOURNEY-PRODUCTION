<?php
declare(strict_types=1);
date_default_timezone_set('Asia/Dhaka');

function app_root(string $path=''): string { $r=dirname(__DIR__); return $path?$r.'/'.ltrim($path,'/'):$r; }
function envv(string $key, mixed $default=null): mixed {
    static $loaded=false;
    if(!$loaded){$f=app_root('.env'); if(is_file($f)){foreach(file($f,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) as $l){$l=trim($l);if($l===''||str_starts_with($l,'#')||!str_contains($l,'='))continue;[$k,$v]=explode('=',$l,2);$_ENV[trim($k)]=trim($v);}}$loaded=true;}
    return $_ENV[$key]??$default;
}
function db(): PDO { static $pdo; if($pdo)return $pdo; $pdo=new PDO('mysql:host='.envv('DB_HOST','localhost').';port='.envv('DB_PORT','3306').';dbname='.envv('DB_DATABASE').';charset=utf8mb4',envv('DB_USERNAME'),envv('DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]); return $pdo; }
function h(string $v): string{return htmlspecialchars($v,ENT_QUOTES,'UTF-8');}
function storage_path(string $p=''): string{$b=app_root('storage');return $p?$b.'/'.ltrim($p,'/'):$b;}
function start_session():void{if(session_status()!==PHP_SESSION_ACTIVE){session_name('ALOADMIN');session_set_cookie_params(['secure'=>true,'httponly'=>true,'samesite'=>'Lax','path'=>'/']);session_start();}} start_session();
function csrf_token():string{if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));return $_SESSION['csrf'];}
function csrf_field():string{return "<input type='hidden' name='csrf' value='".h(csrf_token())."'>";}
function csrf_check():void{if(!hash_equals($_SESSION['csrf']??'',$_POST['csrf']??'')){http_response_code(419);exit('CSRF failed');}}
function login_admin(string $email,string $password):bool{$s=db()->prepare("SELECT * FROM admins WHERE email=? AND is_active=1 LIMIT 1");$s->execute([$email]);$a=$s->fetch();if(!$a||!password_verify($password,$a['password_hash']))return false;$_SESSION['admin_id']=$a['id'];session_regenerate_id(true);db()->prepare("UPDATE admins SET last_login_at=NOW() WHERE id=?")->execute([$a['id']]);audit((int)$a['id'],'login');return true;}
function current_admin():?array{if(empty($_SESSION['admin_id']))return null;$s=db()->prepare("SELECT * FROM admins WHERE id=? AND is_active=1");$s->execute([$_SESSION['admin_id']]);return $s->fetch()?:null;}
function require_admin():array{$a=current_admin();if(!$a){header('Location:/admin/login');exit;}return $a;}
function logout_admin():void{session_destroy();}
function encrypt_secret(string $plain):string{$key=hash('sha256',(string)envv('TOKEN_ENCRYPTION_KEY'),true);$nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);return base64_encode($nonce.sodium_crypto_secretbox($plain,$nonce,$key));}
function decrypt_secret(string $enc):string{$raw=base64_decode($enc,true);if(!$raw)return '';$nonce=substr($raw,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);$cipher=substr($raw,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);$key=hash('sha256',(string)envv('TOKEN_ENCRYPTION_KEY'),true);return sodium_crypto_secretbox_open($cipher,$nonce,$key)?:'';}
function audit(?int $adminId,string $action,array $meta=[]):void{$s=db()->prepare("INSERT INTO audit_logs(admin_id,action,metadata,ip_address,user_agent) VALUES(?,?,?,?,?)");$s->execute([$adminId,$action,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,substr($_SERVER['HTTP_USER_AGENT']??'',0,255)]);}
function setting(string $k,string $d=''):string{$s=db()->prepare("SELECT value FROM settings WHERE `key`=?");$s->execute([$k]);$v=$s->fetchColumn();return $v===false?$d:(string)$v;}
function set_setting(string $k,string $v):void{db()->prepare("INSERT INTO settings(`key`,value) VALUES(?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)")->execute([$k,$v]);}
function is_emergency_stop():bool{return setting('emergency_stop','false')==='true';}
function flash(string $m):void{$_SESSION['flash']=$m;}
function flash_html():string{$m=$_SESSION['flash']??'';unset($_SESSION['flash']);return $m?"<div class='alert'>".h($m)."</div>":'';}
function curl_json(string $url,array $payload=[],array $headers=[],string $method='POST'):array{$ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>120,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>array_merge(['Content-Type: application/json'],$headers)]);if($method!=='GET')curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($payload,JSON_UNESCAPED_UNICODE));$raw=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);return ['ok'=>$raw!==false&&$code>=200&&$code<300,'code'=>$code,'json'=>json_decode((string)$raw,true),'raw'=>$raw,'error'=>$err];}
