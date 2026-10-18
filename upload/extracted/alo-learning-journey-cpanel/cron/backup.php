<?php
require dirname(__DIR__).'/app/bootstrap.php';
$dir=storage_path('backups');if(!is_dir($dir))mkdir($dir,0775,true);
$file=$dir.'/backup_'.date('Ymd_His').'.sql.gz';
$cmd=sprintf("mysqldump -h%s -u%s -p%s %s | gzip > %s",escapeshellarg(envv('DB_HOST','localhost')),escapeshellarg(envv('DB_USERNAME')),escapeshellarg(envv('DB_PASSWORD')),escapeshellarg(envv('DB_DATABASE')),escapeshellarg($file));
exec($cmd,$o,$c);echo $c===0?"ok\n":"failed\n";
