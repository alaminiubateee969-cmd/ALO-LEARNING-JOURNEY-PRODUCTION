<?php
require_once __DIR__.'/bootstrap.php';

function llm_json(string $system,string $prompt):array{
    $key=(string)envv('OPENAI_API_KEY');
    if($key==='')return [];
    $r=curl_json('https://api.openai.com/v1/chat/completions',[
        'model'=>envv('OPENAI_MODEL','gpt-4.1-mini'),'temperature'=>0.65,
        'response_format'=>['type'=>'json_object'],
        'messages'=>[['role'=>'system','content'=>$system],['role'=>'user','content'=>$prompt]]
    ],['Authorization: Bearer '.$key]);
    $t=$r['json']['choices'][0]['message']['content']??'';
    return $t?(json_decode($t,true)?:[]):[];
}
function fallback_ideas(string $focus=''):array{
    $base=$focus?:'positive parenting';
    $arr=[
        ['topic'=>"{$base}: ঘরে ৫ মিনিটের শেখার খেলা",'hook'=>'আজ মাত্র ৫ মিনিটেই শেখা শুরু করুন 💛','pillar'=>'Home Learning'],
        ['topic'=>'শিশুর screen time কমানোর শান্ত উপায়','hook'=>'ফোন কেড়ে নেওয়া নয়, বিকল্প তৈরি করুন','pillar'=>'Screen Time'],
        ['topic'=>'Learning colours in Bangla and English','hook'=>'আপনার সোনামণির প্রিয় রঙ কোনটি?','pillar'=>'Baby Learning'],
        ['topic'=>'Daily conversation for speech support','hook'=>'প্রতিদিনের কথাই হতে পারে learning activity','pillar'=>'Speech Awareness'],
        ['topic'=>'Tantrum-এর সময় বাবা-মা কী করবেন','hook'=>'কান্নার মুহূর্তে শান্ত থাকার ৩টি ধাপ','pillar'=>'Positive Parenting'],
        ['topic'=>'Preschool readiness checklist','hook'=>'স্কুলে যাওয়ার আগে কোন skillগুলো দরকার?','pillar'=>'Early Education'],
        ['topic'=>'Parent-child emotional bonding','hook'=>'দিনে ১০ মিনিট connection অনেক বড় পরিবর্তন আনে','pillar'=>'Emotional Bonding'],
        ['topic'=>'Bedtime routine for toddlers','hook'=>'ঘুমের আগে একই ৩টি কাজ করুন','pillar'=>'Daily Routine'],
        ['topic'=>'Alphabet learning through play','hook'=>'বই নয় শুধু, খেলায় খেলায় অক্ষর শিখি','pillar'=>'Baby Learning'],
        ['topic'=>'Parent motivation on difficult days','hook'=>'Perfect parent নয়, present parent দরকার','pillar'=>'Parent Motivation'],
    ];
    return $arr;
}
function save_ideas(array $ideas):array{
    $out=[];$s=db()->prepare("INSERT INTO content_ideas(topic,viral_hook,pillar,risk_level,seo_keywords,status) VALUES(?,?,?,?,?,'topic_ready')");
    foreach($ideas as $i){$s->execute([$i['topic']??'',$i['hook']??$i['viral_hook']??'',$i['pillar']??'Parenting','low',json_encode($i['seo_keywords']??[],JSON_UNESCAPED_UNICODE)]);$out[]=(int)db()->lastInsertId();}
    return $out;
}
function list_ideas():array{return db()->query("SELECT * FROM content_ideas ORDER BY id DESC LIMIT 100")->fetchAll();}
function build_content_package(array $idea):array{
    $system="You create warm, practical, child-safe Bengali parenting content for ALO Learning Journey. Never diagnose, shame, frighten or promise guaranteed outcomes. Return strict JSON.";
    $prompt="Topic: {$idea['topic']}\nHook: {$idea['viral_hook']}\nReturn keys: hook,reel_script,youtube_short_script,facebook_caption,instagram_caption,tiktok_caption,youtube_title,youtube_description,linkedin_post,x_thread,whatsapp_message,hashtags,pinned_comment,auto_replies,thumbnail_text,image_prompts,video_prompts,seo_keywords,srt.";
    $a=llm_json($system,$prompt);
    if(!$a){$d='প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛';$a=[
        'hook'=>$idea['viral_hook'],'reel_script'=>$idea['viral_hook']."\n\nপ্রতিটি শিশুর learning journey আলাদা। আজ ৩টি সহজ কাজ করুন: কথা বলুন, খেলুন, গল্প পড়ুন।\n\n".$d,
        'youtube_short_script'=>$idea['viral_hook']."\nআজকের ৩টি সহজ parenting tip...",
        'facebook_caption'=>$idea['viral_hook']."\n\nছোট ছোট অভ্যাসই শেখাকে আনন্দময় করে। Save ও Share করুন 💛",
        'instagram_caption'=>$idea['viral_hook']."\n\nFollow ALO Learning Journey ✨",
        'tiktok_caption'=>$idea['viral_hook']." #BanglaParenting #ALOlearningJourney",
        'youtube_title'=>$idea['topic'].' | Bangla Parenting Tips',
        'youtube_description'=>$idea['topic']."\n\n".$d,
        'linkedin_post'=>$idea['topic']." — practical and positive parenting awareness.",
        'x_thread'=>"1/ ".$idea['viral_hook']."\n2/ Keep it simple.\n3/ Focus on connection.",
        'whatsapp_message'=>"🌸 ".$idea['viral_hook']."\nআজকের tip: কথা, খেলা ও গল্প।",
        'hashtags'=>['#ALOlearningJourney','#BanglaParenting','#BabyLearning','#ChildDevelopment'],
        'pinned_comment'=>'আপনার অভিজ্ঞতা কমেন্টে জানান 💛','auto_replies'=>['ধন্যবাদ পাশে থাকার জন্য 💛'],
        'thumbnail_text'=>$idea['viral_hook'],'image_prompts'=>['soft pastel realistic Bangladeshi family'], 'video_prompts'=>['9:16 warm family reel'],
        'seo_keywords'=>['Bangla parenting','baby learning','child development'],'srt'=>''
    ];}
    return $a;
}
function safety_review(array $p):array{
    $txt=mb_strtolower(json_encode($p,JSON_UNESCAPED_UNICODE));
    $flags=[];foreach(['guaranteed cure','diagnose','parent shaming','ভয় দেখান','শাস্তি দিন'] as $bad)if(str_contains($txt,$bad))$flags[]=$bad;
    return ['approved'=>!$flags,'risk_level'=>$flags?'high':'low','required_edits'=>$flags,'disclaimer'=>'This content is educational, not a medical diagnosis.'];
}
function create_placeholder_assets(int $packageId,string $title):void{
    $sizes=['facebook_feed'=>'1200x630','instagram_square'=>'1080x1080','vertical_reel'=>'1080x1920','youtube_thumbnail'=>'1280x720','linkedin'=>'1200x627','x_post'=>'1600x900','whatsapp_status'=>'1080x1920'];
    $dir=storage_path("generated/images/package_{$packageId}");if(!is_dir($dir))mkdir($dir,0775,true);
    foreach($sizes as $label=>$size){[$w,$h]=array_map('intval',explode('x',$size));$im=imagecreatetruecolor($w,$h);$cream=imagecolorallocate($im,255,248,240);$pink=imagecolorallocate($im,255,217,230);$blue=imagecolorallocate($im,220,239,255);$txt=imagecolorallocate($im,92,55,82);imagefill($im,0,0,$cream);imagefilledellipse($im,(int)($w*.82),(int)($h*.2),(int)($w*.5),(int)($h*.5),$pink);imagefilledellipse($im,(int)($w*.18),(int)($h*.78),(int)($w*.35),(int)($h*.35),$blue);imagestring($im,5,30,30,'ALO Learning Journey',$txt);imagestring($im,4,30,65,substr($title,0,60),$txt);$path="$dir/{$label}.jpg";imagejpeg($im,$path,92);imagedestroy($im);db()->prepare("INSERT INTO assets(content_package_id,asset_type,platform,size_label,width,height,file_path,status) VALUES(?,?,?,?,?,?,?,'ready')")->execute([$packageId,'image',$label,$size,$w,$h,$path]);}
}
function dashboard_stats():array{return ['Connected platforms'=>(int)db()->query("SELECT COUNT(*) FROM social_connections WHERE token_status='connected'")->fetchColumn(),'Topic ideas'=>(int)db()->query("SELECT COUNT(*) FROM content_ideas")->fetchColumn(),'Content packages'=>(int)db()->query("SELECT COUNT(*) FROM content_packages")->fetchColumn(),'Pending approvals'=>(int)db()->query("SELECT COUNT(*) FROM approval_queue WHERE status='pending_admin_approval'")->fetchColumn(),'Published'=>(int)db()->query("SELECT COUNT(*) FROM publishing_jobs WHERE status='published'")->fetchColumn(),'Failed'=>(int)db()->query("SELECT COUNT(*) FROM publishing_jobs WHERE status='failed'")->fetchColumn()];}
function list_packages():array{return db()->query("SELECT p.*,i.topic FROM content_packages p JOIN content_ideas i ON i.id=p.content_idea_id ORDER BY p.id DESC")->fetchAll();}
function get_package(int $id):?array{$s=db()->prepare("SELECT p.*,i.topic FROM content_packages p JOIN content_ideas i ON i.id=p.content_idea_id WHERE p.id=?");$s->execute([$id]);return $s->fetch()?:null;}
function approval_items():array{return db()->query("SELECT a.*,p.quality_score,i.topic FROM approval_queue a JOIN content_packages p ON p.id=a.content_package_id JOIN content_ideas i ON i.id=p.content_idea_id ORDER BY a.id DESC")->fetchAll();}
function process_approval(int $id,string $action,int $adminId):void{
    $allowed=['approved','rejected','edit_requested'];if(!in_array($action,$allowed,true))return;
    db()->prepare("UPDATE approval_queue SET status=?,approved_by=?,approved_at=IF(?='approved',NOW(),NULL) WHERE id=?")->execute([$action,$adminId,$action,$id]);
    if($action==='approved'){ $s=db()->prepare("SELECT content_package_id FROM approval_queue WHERE id=?");$s->execute([$id]);$pid=(int)$s->fetchColumn();db()->prepare("UPDATE content_packages SET status='approved' WHERE id=?")->execute([$pid]);foreach(['facebook','instagram','youtube','tiktok','whatsapp','linkedin','x'] as $p)db()->prepare("INSERT INTO publishing_jobs(content_package_id,platform,status) VALUES(?,?,'queued')")->execute([$pid,$p]);}
}
function list_assets():array{return db()->query("SELECT * FROM assets ORDER BY id DESC LIMIT 100")->fetchAll();}
function analytics_summary():array{return dashboard_stats();}
function connected_platforms():array{$r=[];foreach(db()->query("SELECT platform FROM social_connections WHERE token_status='connected'")->fetchAll() as $x)$r[$x['platform']]=true;return $r;}
function oauth_start_url(string $provider):?string{
    $state=bin2hex(random_bytes(16));$_SESSION['oauth_state_'.$provider]=$state;$base=rtrim((string)envv('APP_URL'),'/');
    return match($provider){
        'meta'=>envv('META_APP_ID')?"https://www.facebook.com/v23.0/dialog/oauth?client_id=".urlencode(envv('META_APP_ID'))."&redirect_uri=".urlencode($base.'/oauth/meta/callback')."&state={$state}&scope=".urlencode('pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish'):null,
        'youtube'=>envv('YOUTUBE_CLIENT_ID')?"https://accounts.google.com/o/oauth2/v2/auth?client_id=".urlencode(envv('YOUTUBE_CLIENT_ID'))."&redirect_uri=".urlencode($base.'/oauth/youtube/callback')."&response_type=code&access_type=offline&prompt=consent&state={$state}&scope=".urlencode('openid email profile https://www.googleapis.com/auth/youtube.upload'):null,
        'tiktok'=>envv('TIKTOK_CLIENT_KEY')?"https://www.tiktok.com/v2/auth/authorize/?client_key=".urlencode(envv('TIKTOK_CLIENT_KEY'))."&response_type=code&scope=".urlencode('user.info.basic,video.upload,video.publish')."&redirect_uri=".urlencode($base.'/oauth/tiktok/callback')."&state={$state}":null,
        'linkedin'=>envv('LINKEDIN_CLIENT_ID')?"https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=".urlencode(envv('LINKEDIN_CLIENT_ID'))."&redirect_uri=".urlencode($base.'/oauth/linkedin/callback')."&scope=".urlencode('openid profile w_member_social')."&state={$state}":null,
        'x'=>null,'whatsapp'=>null,default=>null};
}
function oauth_callback(string $provider,array $query,int $adminId):void{
    $state=(string)($query['state']??'');if(!$state||!hash_equals($_SESSION['oauth_state_'.$provider]??'',$state))throw new RuntimeException('Invalid OAuth state');
    $code=(string)($query['code']??'');if($code==='')throw new RuntimeException('Missing authorization code');
    // Provider token exchange is intentionally not faked. Save pending until configured adapter exchanges the code.
    db()->prepare("INSERT INTO social_connections(platform,token_status,connected_by,metadata) VALUES(?,'pending',?,?)")->execute([$provider,$adminId,json_encode(['authorization_code_received'=>true,'note'=>'Complete official token exchange in adapter'],JSON_UNESCAPED_UNICODE)]);
    audit($adminId,'oauth_callback_received',['provider'=>$provider]);
}
function telegram_webhook():void{
    $secret=(string)envv('TELEGRAM_WEBHOOK_SECRET');if($secret!==''&&($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN']??'')!==$secret){http_response_code(403);exit;}
    $u=json_decode(file_get_contents('php://input'),true)?:[];$text=trim((string)($u['message']['text']??''));$chat=(string)($u['message']['chat']['id']??'');
    if($chat!==''&&envv('TELEGRAM_ADMIN_CHAT_ID')!==''&&!hash_equals((string)envv('TELEGRAM_ADMIN_CHAT_ID'),$chat)){http_response_code(403);exit;}
    $reply='Command received.';
    if($text==='/ideas'){(new MasterOrchestratorAgent())->generateIdeas('');$reply='10 topic ideas generated.';}
    elseif(str_starts_with($text,'/create ')){(new MasterOrchestratorAgent())->generateIdeas(trim(substr($text,8)));$reply='Topic ideas generated for your command.';}
    elseif($text==='/analytics')$reply=json_encode(analytics_summary(),JSON_UNESCAPED_UNICODE);
    elseif($text==='/emergency_stop'){set_setting('emergency_stop','true');$reply='Emergency stop enabled.';}
    $token=(string)envv('TELEGRAM_BOT_TOKEN');if($token&&$chat)curl_json("https://api.telegram.org/bot{$token}/sendMessage",['chat_id'=>$chat,'text'=>$reply]);
    echo 'ok';
}
