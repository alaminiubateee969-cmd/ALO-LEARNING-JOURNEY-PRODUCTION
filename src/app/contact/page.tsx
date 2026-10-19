import type { Metadata } from "next";
import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact — ALO Learning Journey | info@learn.aloeducation.com",
  description: "Contact ALO Learning Journey — Email info@learn.aloeducation.com, Phone 01805-020103, Facebook ALOLearningJourney. IMAP learn.aloeducation.com:993 / SMTP learn.aloeducation.com:465",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center shadow-md">
              <span className="text-white font-bold">আ</span>
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">আলো <span className="text-amber-600">Learning Journey</span></p>
              <p className="text-[11px] text-muted-foreground">learn.aloeducation.com</p>
            </div>
          </a>
          <a href="/login" className="text-xs font-medium px-3 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Admin login</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3">
          <h1 className="text-2xl font-bold tracking-tight">যোগাযোগ করুন</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            ALO Learning Journey — শিশুদের শিক্ষা ও প্যারেন্টিং নিয়ে সচেতনতা ✨<br />
            যেকোনো প্রশ্ন, ভর্তি তথ্য বা সহযোগিতার জন্য নিচের ফর্ম ব্যবহার করুন — উত্তর <code>info@learn.aloeducation.com</code> থেকে পাঠানো হবে।
          </p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </section>

        <aside className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border/60 bg-white dark:bg-zinc-900 p-5 shadow-sm">
            <h2 className="font-semibold text-sm">Direct contact</h2>
            <div className="mt-4 space-y-3 text-sm">
              <a href="mailto:info@learn.aloeducation.com" className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors">
                <span className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">✉️</span>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium font-mono text-sm">info@learn.aloeducation.com</p>
                </div>
              </a>
              <a href="tel:+8801805020103" className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 transition-colors">
                <span className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">📞</span>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium font-mono text-sm">01805-020103</p>
                </div>
              </a>
              <a href="https://www.facebook.com/ALOLearningJourney" target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 transition-colors">
                <span className="h-8 w-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-xs">f</span>
                <div>
                  <p className="text-xs text-muted-foreground">Facebook</p>
                  <p className="font-medium text-sm">ALOLearningJourney</p>
                </div>
              </a>
            </div>
            <div className="mt-5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Mail server (cPanel)</p>
              <p className="mt-1 font-mono">IMAP: learn.aloeducation.com:993 (SSL/TLS)</p>
              <p className="font-mono">SMTP: learn.aloeducation.com:465 (SSL/TLS)</p>
              <p className="mt-1">Username: <code>info@learn.aloeducation.com</code></p>
              <p className="text-[11px]">Configure in Gmail/Outlook/iOS Mail using the SSL ports above.</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Response time</p>
            <p className="mt-1 text-xs text-amber-800/70 dark:text-amber-200/70">We reply within 24 hours on working days. For urgent matters, call 01805-020103.</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-white dark:bg-zinc-900 p-4 text-xs text-muted-foreground">
            <p>🌐 <a href="https://learn.aloeducation.com" className="font-medium text-amber-600 hover:underline">learn.aloeducation.com</a></p>
            <p className="mt-1">আলো — ভালোবাসা দিয়ে শেখার পথ 💛✨</p>
          </div>
        </aside>
      </main>

      <footer className="mt-10 border-t border-border/40 bg-background/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ALO Education — learn.aloeducation.com</p>
          <p className="flex items-center gap-2"><span>info@learn.aloeducation.com</span> · <span>01805-020103</span> · <a href="https://www.facebook.com/ALOLearningJourney" target="_blank" rel="noreferrer" className="hover:text-foreground">Facebook</a></p>
        </div>
      </footer>
    </div>
  );
}
