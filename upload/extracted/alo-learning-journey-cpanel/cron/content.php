<?php
require dirname(__DIR__).'/app/agents.php';
$rows=db()->query("SELECT id FROM content_ideas WHERE status='topic_ready' ORDER BY id ASC LIMIT 1")->fetchAll();
foreach($rows as $r)(new MasterOrchestratorAgent())->buildPackage((int)$r['id']);
echo "ok\n";
