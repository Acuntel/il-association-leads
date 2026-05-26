import { chromium } from "playwright";
const ctx = await chromium.launchPersistentContext(".chromium-profile", {
  headless: false, channel: "chrome", args: ["--disable-blink-features=AutomationControlled"],
});
const page = await ctx.newPage();
await page.goto("https://apps.ilsos.gov/businessentitysearch/", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(2500);
await page.locator("#keyWord").check().catch(e=>console.log("radio err",e.message));
await page.locator("#searchValue").fill("condominium association");
// submit: press Enter in the field
await page.locator("#searchValue").press("Enter");
await page.waitForTimeout(5000);
console.log("RESULTS URL:", page.url());
const res = await page.evaluate(() => {
  const tables = [...document.querySelectorAll("table")].map(t => ({
    rows: t.rows.length,
    head: (t.querySelector("thead,tr")?.textContent||"").replace(/\s+/g," ").trim().slice(0,120),
  }));
  const links = [...document.querySelectorAll("a")].filter(a=>/detail|entity|file/i.test(a.href)||/detail/i.test(a.getAttribute("onclick")||"")).slice(0,5)
     .map(a=>({href:a.href, oc:(a.getAttribute("onclick")||"").slice(0,60), txt:(a.textContent||"").trim().slice(0,40)}));
  const firstRowsText = [...document.querySelectorAll("table tr")].slice(0,4).map(r=>(r.textContent||"").replace(/\s+/g," ").trim().slice(0,100));
  return { tables, links, firstRowsText, bodyStart:(document.body.textContent||"").replace(/\s+/g," ").trim().slice(0,200) };
});
console.log(JSON.stringify(res, null, 1).slice(0,2800));
await ctx.close();
