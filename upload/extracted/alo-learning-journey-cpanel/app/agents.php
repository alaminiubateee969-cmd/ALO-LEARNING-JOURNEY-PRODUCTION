<?php
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/services.php';

final class MasterOrchestratorAgent {
    public function generateIdeas(string $focus=''): array {
        $r=llm_json('You are ALO Learning Journey TopicIdeationAgent. Return JSON only.',"Generate 10 Bengali parenting topics. Focus: {$focus}. Return {ideas:[{topic,hook,pillar,seo_keywords}]}");
        $ideas=$r['ideas']??fallback_ideas($focus);
        save_ideas($ideas);
        return $ideas;
    }
    public function buildPackage(int $ideaId): int {
        $s=db()->prepare("SELECT * FROM content_ideas WHERE id=?");$s->execute([$ideaId]);$idea=$s->fetch();if(!$idea)throw new RuntimeException('Idea not found');
        $p=build_content_package($idea);$safe=safety_review($p);
        $sql="INSERT INTO content_packages(content_idea_id,hook,reel_script,youtube_short_script,facebook_caption,instagram_caption,tiktok_caption,youtube_title,youtube_description,linkedin_post,x_thread,whatsapp_message,hashtags,pinned_comment,auto_replies,thumbnail_text,image_prompts,video_prompts,seo_keywords,safety_json,risk_level,quality_score,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,90,?)";
        db()->prepare($sql)->execute([$ideaId,$p['hook']??$idea['viral_hook'],$p['reel_script']??'',$p['youtube_short_script']??'',$p['facebook_caption']??'',$p['instagram_caption']??'',$p['tiktok_caption']??'',$p['youtube_title']??$idea['topic'],$p['youtube_description']??'',$p['linkedin_post']??'',$p['x_thread']??'',$p['whatsapp_message']??'',json_encode($p['hashtags']??[],JSON_UNESCAPED_UNICODE),$p['pinned_comment']??'',json_encode($p['auto_replies']??[],JSON_UNESCAPED_UNICODE),$p['thumbnail_text']??'',json_encode($p['image_prompts']??[],JSON_UNESCAPED_UNICODE),json_encode($p['video_prompts']??[],JSON_UNESCAPED_UNICODE),json_encode($p['seo_keywords']??[],JSON_UNESCAPED_UNICODE),json_encode($safe,JSON_UNESCAPED_UNICODE),$safe['risk_level'],$safe['approved']?'safety_approved':'needs_revision']);
        db()->prepare("UPDATE content_ideas SET status='content_generated' WHERE id=?")->execute([$ideaId]);
        return (int)db()->lastInsertId();
    }
    public function prepareApproval(int $packageId): void {
        $p=get_package($packageId);if(!$p)throw new RuntimeException('Package not found');
        create_placeholder_assets($packageId,$p['topic']);
        db()->prepare("UPDATE content_packages SET status='pending_admin_approval' WHERE id=?")->execute([$packageId]);
        db()->prepare("INSERT INTO approval_queue(content_package_id,status) VALUES(?,'pending_admin_approval')")->execute([$packageId]);
    }
}
