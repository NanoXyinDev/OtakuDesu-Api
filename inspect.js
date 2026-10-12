// Pakai: node inspect.js <url> [--html]
// Contoh: node inspect.js https://otakudesu.blog/anime/oni-hanayome-sub-indo/
// Salin seluruh output ke chat supaya selector API bisa dicocokkan dengan struktur asli.
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const url = process.argv[2];
if (!url) {
  console.log("Pakai: node inspect.js <url> [--html]");
  process.exit(1);
}

(async () => {
  const res = await axios.get(url, {
    timeout: 20000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "id-ID,id;q=0.9",
    },
  });
  const html = res.data;
  const $ = cheerio.load(html);
  const clean = (s = "") => s.replace(/\s+/g, " ").trim();
  const line = (t) => console.log("\n=== " + t + " ===");

  if (process.argv.includes("--html")) {
    fs.writeFileSync("page.html", html);
    console.log("HTML mentah disimpan ke page.html");
  }

  line("INFO");
  console.log("status:", res.status, "| ukuran:", html.length, "byte");
  console.log("title:", clean($("title").text()));

  line("SCRIPT EKSTERNAL");
  $("script[src]").each((_, s) => console.log($(s).attr("src")));

  line("INLINE SCRIPT (baris penting: ajax, nonce, action, iframe)");
  $("script:not([src])").each((_, s) => {
    const code = $(s).html() || "";
    code
      .split("\n")
      .filter((l) => /ajax|nonce|action|iframe|stream|embed|base64|atob/i.test(l))
      .slice(0, 15)
      .forEach((l) => console.log(clean(l).slice(0, 200)));
  });

  line("IFRAME");
  $("iframe").each((_, f) => console.log($(f).attr("src") || $(f).attr("data-src")));

  line("CONTAINER UTAMA (class yang sering muncul)");
  const count = {};
  $("[class]").each((_, el) =>
    $(el)
      .attr("class")
      .split(/\s+/)
      .forEach((c) => c && (count[c] = (count[c] || 0) + 1))
  );
  Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .forEach(([c, n]) => console.log(`.${c}  x${n}`));

  line("DAFTAR EPISODE (.episodelist)");
  $(".episodelist ul li").slice(0, 5).each((_, li) => console.log(clean($(li).text()), "->", $(li).find("a").attr("href")));
  console.log("total li:", $(".episodelist ul li").length);

  line("INFO ANIME (.infozingle p)");
  $(".infozingle p").each((_, p) => console.log(clean($(p).text())));

  line("MIRROR STREAM (data-content didekode)");
  $(".mirrorstream ul").each((_, ul) => {
    console.log("grup:", $(ul).attr("class"));
    $(ul)
      .find("li a")
      .slice(0, 3)
      .each((_, a) => {
        const dc = $(a).attr("data-content");
        let dec = "";
        try {
          dec = Buffer.from(dc, "base64").toString("utf8");
        } catch {}
        console.log(" ", clean($(a).text()), "|", dec);
      });
  });

  line("BLOK DOWNLOAD (outline HTML)");
  $(".download, .batchlink").each((_, el) => {
    console.log(($.html(el) || "").replace(/\s+/g, " ").slice(0, 1500));
  });

  line("LINK /batch/ /lengkap/");
  $("a[href*='/batch/'], a[href*='/lengkap/']").each((_, a) => console.log($(a).attr("href")));
})().catch((e) => console.error("Gagal:", e.message));
