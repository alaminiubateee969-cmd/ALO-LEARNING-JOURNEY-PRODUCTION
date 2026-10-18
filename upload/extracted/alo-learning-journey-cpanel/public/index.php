<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';
require dirname(__DIR__) . '/app/services.php';
require dirname(__DIR__) . '/app/agents.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function view(string $title, string $body, bool $nav = true): never {
    $brand = 'ALO Learning Journey';
    $navHtml = $nav && current_admin() ? nav_html() : '';
    $csrf = csrf_token();
    echo "<!doctype html><html lang='bn'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>" . h($title) . "</title><link rel='stylesheet' href='/assets/app.css'></head><body>{$navHtml}<main class='container'>{$body}</main><script>window.CSRF=" . json_encode($csrf) . ";</script><script src='/assets/app.js'></script></body></html>";
    exit;
}

function nav_html(): string {
    return "<header class='topbar'><div><strong>ALO Learning Journey</strong><small>Admin AI Studio</small></div><nav>
    <a href='/admin/dashboard'>Dashboard</a><a href='/admin/topics'>Topics</a><a href='/admin/content'>Content</a>
    <a href='/admin/approval'>Approval</a><a href='/admin/social'>Social</a><a href='/admin/assets'>Assets</a>
    <a href='/admin/analytics'>Analytics</a><a href='/admin/settings'>Settings</a><a href='/admin/logout'>Logout</a>
    </nav></header>";
}

if ($path === '/') {
    header('Location: /admin/login'); exit;
}

if ($path === '/install') {
    require dirname(__DIR__) . '/install/install.php'; exit;
}

if ($path === '/admin/login') {
    if (current_admin()) { header('Location: /admin/dashboard'); exit; }
    $error = '';
    if ($method === 'POST') {
        csrf_check();
        $email = trim((string)($_POST['email'] ?? ''));
        $password = (string)($_POST['password'] ?? '');
        if (!login_admin($email, $password)) $error = 'Invalid email or password.';
        else { header('Location: /admin/dashboard'); exit; }
    }
    $body = "<section class='login-wrap'><form class='card login-card' method='post'><div class='brand-orb'>ALO</div><h1>Admin Login</h1><p>Only the authorised administrator can access this system.</p>" .
        ($error ? "<div class='alert error'>" . h($error) . "</div>" : "") .
        csrf_field() .
        "<label>Email<input name='email' type='email' required></label><label>Password<input name='password' type='password' required></label><button class='btn primary'>Login</button></form></section>";
    view('Admin Login', $body, false);
}

if ($path === '/admin/logout') { logout_admin(); header('Location: /admin/login'); exit; }

$admin = require_admin();

if ($path === '/admin/dashboard') {
    $stats = dashboard_stats();
    $body = "<section class='hero'><div><span class='eyebrow'>AI PARENTING MEDIA ENGINE</span><h1>Warm ideas in, publish-ready stories out.</h1><p>Generate topics, create safe content, review assets and publish after approval.</p></div><a class='btn primary' href='/admin/topics'>Generate Topic Ideas</a></section>";
    $body .= "<section class='grid stats'>";
    foreach ($stats as $label=>$value) $body .= "<article class='card stat'><span>".h($label)."</span><strong>".h((string)$value)."</strong></article>";
    $body .= "</section>";
    $body .= "<section class='grid two'><article class='card'><h2>Daily flow</h2><ol class='flow'><li>Topic ideas</li><li>Script, hooks and SEO</li><li>Safety review</li><li>Images, video and subtitles</li><li>Admin approval</li><li>Publish and analyse</li></ol></article><article class='card'><h2>Telegram commands</h2><code>/ideas<br>/create topic<br>/review<br>/approve ID<br>/publish ID<br>/analytics<br>/emergency_stop</code></article></section>";
    view('Dashboard', $body);
}

if ($path === '/admin/topics') {
    if ($method === 'POST') {
        csrf_check();
        $focus = trim((string)($_POST['focus'] ?? ''));
        $result = (new MasterOrchestratorAgent())->generateIdeas($focus);
        flash('Generated ' . count($result) . ' topic ideas.');
        header('Location: /admin/topics'); exit;
    }
    $ideas = list_ideas();
    $rows = '';
    foreach ($ideas as $i) {
        $rows .= "<tr><td>#".(int)$i['id']."</td><td><strong>".h($i['topic'])."</strong><small>".h($i['viral_hook'])."</small></td><td>".h($i['pillar'])."</td><td><span class='pill'>".h($i['status'])."</span></td><td><form method='post' action='/admin/content/generate'>".csrf_field()."<input type='hidden' name='idea_id' value='".(int)$i['id']."'><button class='btn small'>Build package</button></form></td></tr>";
    }
    $body = flash_html()."<section class='page-head'><div><h1>Topic Ideas</h1><p>Generate safe Bengali parenting and child-learning ideas.</p></div></section>
    <form class='card inline-form' method='post'>".csrf_field()."<input name='focus' placeholder='Optional focus, e.g. screen time or learning colours'><button class='btn primary'>Generate 10 ideas</button></form>
    <section class='card table-card'><table><thead><tr><th>ID</th><th>Topic</th><th>Pillar</th><th>Status</th><th></th></tr></thead><tbody>{$rows}</tbody></table></section>";
    view('Topic Ideas', $body);
}

if ($path === '/admin/content/generate' && $method === 'POST') {
    csrf_check();
    $ideaId = (int)($_POST['idea_id'] ?? 0);
    $packageId = (new MasterOrchestratorAgent())->buildPackage($ideaId);
    flash("Content package #{$packageId} created.");
    header('Location: /admin/content'); exit;
}

if ($path === '/admin/content') {
    $packages = list_packages();
    $cards = '';
    foreach ($packages as $p) {
        $cards .= "<article class='card package'><div><span class='pill'>".h($p['status'])."</span><h3>".h($p['topic'])."</h3><p>".h(mb_strimwidth($p['hook'],0,140,'…'))."</p></div><div class='actions'><a class='btn small' href='/admin/content/view?id=".(int)$p['id']."'>Open</a></div></article>";
    }
    view('Content', "<section class='page-head'><h1>Content Packages</h1></section><section class='grid two'>{$cards}</section>");
}

if ($path === '/admin/content/view') {
    $id = (int)($_GET['id'] ?? 0);
    $p = get_package($id);
    if (!$p) view('Not found', "<div class='card'>Package not found.</div>");
    $body = "<section class='page-head'><div><h1>".h($p['topic'])."</h1><span class='pill'>".h($p['status'])."</span></div></section>
    <section class='grid two'><article class='card'><h2>Hook</h2><p>".nl2br(h($p['hook']))."</p><h2>Reel script</h2><pre>".h($p['reel_script'])."</pre></article>
    <article class='card'><h2>SEO & platform copy</h2><h3>YouTube title</h3><p>".h($p['youtube_title'])."</p><h3>Facebook</h3><pre>".h($p['facebook_caption'])."</pre><h3>Instagram</h3><pre>".h($p['instagram_caption'])."</pre></article></section>
    <section class='card'><h2>Admin action</h2><div class='actions'><form method='post' action='/admin/approval/prepare'>".csrf_field()."<input type='hidden' name='package_id' value='{$id}'><button class='btn primary'>Generate assets & send to approval</button></form></div></section>";
    view('Package', $body);
}

if ($path === '/admin/approval/prepare' && $method === 'POST') {
    csrf_check();
    $id = (int)($_POST['package_id'] ?? 0);
    (new MasterOrchestratorAgent())->prepareApproval($id);
    flash("Package #{$id} sent to approval.");
    header('Location: /admin/approval'); exit;
}

if ($path === '/admin/approval') {
    if ($method === 'POST') {
        csrf_check();
        $id = (int)($_POST['approval_id'] ?? 0);
        $action = (string)($_POST['action'] ?? '');
        process_approval($id, $action, (int)$admin['id']);
        flash("Approval updated.");
        header('Location: /admin/approval'); exit;
    }
    $items = approval_items();
    $cards = '';
    foreach ($items as $a) {
        $cards .= "<article class='card package'><div><span class='pill'>".h($a['status'])."</span><h3>".h($a['topic'])."</h3><p>Quality score: ".h((string)$a['quality_score'])."/100</p></div><form method='post' class='actions'>".csrf_field()."<input type='hidden' name='approval_id' value='".(int)$a['id']."'><button class='btn success' name='action' value='approved'>Approve</button><button class='btn danger' name='action' value='rejected'>Reject</button><button class='btn' name='action' value='edit_requested'>Request edit</button></form></article>";
    }
    view('Approval', flash_html()."<section class='page-head'><h1>Admin Approval Queue</h1></section><section class='grid two'>{$cards}</section>");
}

if ($path === '/admin/social') {
    $platforms = ['meta'=>'Facebook + Instagram','youtube'=>'YouTube','tiktok'=>'TikTok','whatsapp'=>'WhatsApp','linkedin'=>'LinkedIn','x'=>'X / Twitter'];
    $connected = connected_platforms();
    $cards = '';
    foreach ($platforms as $key=>$label) {
        $state = isset($connected[$key]) ? 'Connected' : 'Not connected';
        $cards .= "<article class='card social-card'><div><h3>".h($label)."</h3><span class='pill'>".h($state)."</span></div><a class='btn small' href='/oauth/".h($key)."/start'>Connect securely</a></article>";
    }
    view('Social Connections', "<section class='page-head'><div><h1>Social Connections</h1><p>Official OAuth only. Passwords and OTPs are never stored.</p></div></section><section class='grid two'>{$cards}</section>");
}

if (preg_match('#^/oauth/([a-z]+)/start$#', $path, $m)) {
    $url = oauth_start_url($m[1]);
    if (!$url) { flash('Provider is not configured.'); header('Location: /admin/social'); exit; }
    header('Location: '.$url); exit;
}

if (preg_match('#^/oauth/([a-z]+)/callback$#', $path, $m)) {
    oauth_callback($m[1], $_GET, (int)$admin['id']);
    flash('Connection saved. Provider verification may still be required.');
    header('Location: /admin/social'); exit;
}

if ($path === '/admin/assets') {
    $assets = list_assets();
    $cards = '';
    foreach ($assets as $a) $cards .= "<article class='card'><h3>".h($a['asset_type'])."</h3><p>".h($a['size_label'])." · ".h($a['status'])."</p><small>".h($a['file_path'] ?? '')."</small></article>";
    view('Assets', "<section class='page-head'><h1>Generated Assets</h1></section><section class='grid three'>{$cards}</section>");
}

if ($path === '/admin/analytics') {
    $s = analytics_summary();
    $cards=''; foreach($s as $k=>$v) $cards.="<article class='card stat'><span>".h($k)."</span><strong>".h((string)$v)."</strong></article>";
    view('Analytics', "<section class='page-head'><h1>Analytics</h1></section><section class='grid stats'>{$cards}</section>");
}

if ($path === '/admin/settings') {
    if ($method === 'POST') {
        csrf_check();
        set_setting('emergency_stop', isset($_POST['emergency_stop']) ? 'true':'false');
        flash('Settings saved.'); header('Location: /admin/settings'); exit;
    }
    $checked = is_emergency_stop() ? 'checked':'';
    view('Settings', flash_html()."<section class='page-head'><h1>Settings</h1></section><form class='card' method='post'>".csrf_field()."<label class='check'><input type='checkbox' name='emergency_stop' {$checked}> Emergency stop all publishing</label><button class='btn primary'>Save</button></form>");
}

if ($path === '/telegram/webhook' && $method === 'POST') {
    telegram_webhook(); exit;
}

http_response_code(404);
view('Not found', "<div class='card'><h1>404</h1><p>Page not found.</p></div>");
