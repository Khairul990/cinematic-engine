# GitHub Actions সেটআপ (২ মিনিটের কাজ)

বর্তমান টোকেনে `workflow` স্কোপ না থাকায় CI ফাইলটা অটো-পুশ হয়নি (GitHub-এর নিরাপত্তা নিয়ম)।
নিচের যেকোনো একটা উপায়ে চালু করে নাও:

## উপায় ১ — GitHub ওয়েবসাইট থেকে (সবচেয়ে সহজ, টোকেন লাগবে না)

1. https://github.com/Khairul990/cinematic-engine এ যাও
2. **Add file → Create new file**
3. নামের ঘরে লেখো: `.github/workflows/test.yml`
   (ফোল্ডারের নাম `/` দিয়ে লিখলে GitHub নিজেই ফোল্ডার বানিয়ে নেবে)
4. `ci/github-actions-test.yml` ফাইলের পুরো কনটেন্ট কপি করে বসাও
5. **Commit changes** চাপো → ব্যস, প্রতি push-এ ৫৪টি টেস্ট অটো চলবে

## উপায় ২ — নতুন টোকেন দিয়ে (লোকাল থেকে)

1. https://github.com/settings/tokens → পুরনো টোকেন **revoke** করো (চ্যাটে দিয়েছিলে, তাই বাতিল করা জরুরি)
2. নতুন **Fine-grained token** বানাও:
   - Repository access: **Only select repositories** → `cinematic-engine`
   - Permissions: **Contents: Read and write** + **Workflows: Read and write**
   - Expiration: ৩০ দিন
3. নিজের কম্পিউটারে:

```bash
git clone https://github.com/Khairul990/cinematic-engine.git
cd cinematic-engine
mkdir -p .github/workflows
cp ci/github-actions-test.yml .github/workflows/test.yml
git rm -r --cached ci >/dev/null 2>&1 || true
git add .github/workflows/test.yml
git commit -m "ci: ৫৪টি টেস্ট প্রতি push-এ অটো চালানো"
git push
# ইউজারনেম জিজ্ঞেস করলে: Khairul990
# পাসওয়ার্ড জিজ্ঞেস করলে: নতুন টোকেনটা পেস্ট করো
```
