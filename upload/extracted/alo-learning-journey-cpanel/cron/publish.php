<?php
require dirname(__DIR__).'/app/bootstrap.php';
if(is_emergency_stop()){echo "stopped\n";exit;}
$jobs=db()->query("SELECT * FROM publishing_jobs WHERE status='queued' ORDER BY id ASC LIMIT 10")->fetchAll();
foreach($jobs as $j){
  // Official provider adapters must be configured. Never fake a successful post.
  db()->prepare("UPDATE publishing_jobs SET status='failed',error_text=? WHERE id=?")->execute(['Provider adapter/approval not configured yet.',$j['id']]);
}
echo "processed\n";
