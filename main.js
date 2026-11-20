(() => {
  "use strict";

  const data = Array.isArray(window.GARBAGE_DATA) ? window.GARBAGE_DATA : [];
  const categoryMeta = {
    "可回收物": { slug: "recycle", icon: "images/recycle.svg", label: "蓝色标识", short: "保持清洁干燥，让材料重新进入循环" },
    "厨余垃圾": { slug: "kitchen", icon: "images/kitchen.svg", label: "绿色标识", short: "去除包装并沥干，让易腐物单独处理" },
    "有害垃圾": { slug: "harmful", icon: "images/harmful.svg", label: "红色标识", short: "保持完整并单独投放，避免环境风险" },
    "其他垃圾": { slug: "other", icon: "images/other.svg", label: "灰色标识", short: "难回收或被污染的生活废弃物" }
  };

  const popularNames = ["矿泉水瓶", "奶茶杯", "纸巾", "废电池", "苹果皮", "快递纸箱", "外卖餐盒", "塑料袋", "易拉罐", "旧书本"];
  const sceneInfo = {
    "宿舍": { kicker: "DORMITORY", title: "宿舍生活", description: "饮料瓶、纸巾、电池和洗护用品最常见。保持可回收物清洁干燥，有害垃圾单独收集。" },
    "食堂": { kicker: "CANTEEN", title: "食堂用餐", description: "先把剩菜剩饭与餐盒分开，沥去汤水。可回收与否，往往取决于容器是否清洁。" },
    "快递站": { kicker: "PARCEL STATION", title: "校园快递站", description: "纸箱压平、胶带撕下、面单隐私处理。干净纸箱回收，污染包装单独投放。" },
    "教室": { kicker: "CLASSROOM", title: "教室学习", description: "纸张尽量双面使用，茶叶渣与包装分开，灯管和打印耗材交给专门收集点。" }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const normalize = (value) => String(value || "").toLowerCase().trim().replace(/[\s·•,，。.!！?？、_\-—()（）/\\]+/g, "");

  let history = loadHistory();
  let toastTimer;

  function levenshtein(a, b) {
    const left = [...a];
    const right = [...b];
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const saved = row[j];
        row[j] = left[i - 1] === right[j - 1]
          ? previous
          : Math.min(previous + 1, row[j] + 1, row[j - 1] + 1);
        previous = saved;
      }
    }
    return row[right.length];
  }

  function scoreItem(item, rawQuery) {
    const query = normalize(rawQuery);
    if (!query) return 0;
    const name = normalize(item.name);
    const keywords = item.keywords.map(normalize);

    if (query === name) return 100;
    if (keywords.includes(query)) return 94;
    if (name.includes(query)) return 84 - Math.min(8, name.length - query.length);
    if (query.includes(name)) return 78 - Math.min(8, query.length - name.length);

    const keywordContains = keywords.find((keyword) => keyword.includes(query) || query.includes(keyword));
    if (keywordContains) return 76 - Math.min(12, Math.abs(keywordContains.length - query.length));

    if (query.length >= 2) {
      const distances = [name, ...keywords].map((term) => levenshtein(query, term));
      const distance = Math.min(...distances);
      const longest = Math.max(query.length, name.length);
      if (distance <= 1) return 68;
      if (distance === 2 && longest >= 4) return 55;
    }
    return 0;
  }

  function rankItems(query) {
    return data
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "zh-CN"));
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem("garbage-search-history") || "[]");
      return Array.isArray(saved) ? saved.slice(0, 8) : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem("garbage-search-history", JSON.stringify(history));
    } catch {
      // 浏览器禁用本地存储时，当前会话仍可正常使用。
    }
  }

  function addHistory(item) {
    const now = new Date();
    history = [
      { name: item.name, category: item.category, time: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) },
      ...history.filter((entry) => entry.name !== item.name)
    ].slice(0, 8);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    const container = $("#historyList");
    if (!history.length) {
      container.innerHTML = '<p class="history-empty">完成一次查询后，记录会出现在这里。</p>';
      return;
    }
    container.innerHTML = history.map((entry) => `
      <button class="history-item" type="button" data-history-query="${escapeHTML(entry.name)}">
        <span>${escapeHTML(entry.name)}</span><small>${escapeHTML(entry.time)}</small>
      </button>
    `).join("");
  }

  function relatedItems(item, ranked) {
    const rankedRelated = ranked
      .map((entry) => entry.item)
      .filter((candidate) => candidate.id !== item.id)
      .slice(0, 3);
    const sameCategory = data
      .filter((candidate) => candidate.category === item.category && candidate.id !== item.id && !rankedRelated.some((entry) => entry.id === candidate.id))
      .slice(0, 3 - rankedRelated.length);
    return [...rankedRelated, ...sameCategory];
  }

  function matchLabel(score) {
    if (score >= 100) return "名称完全匹配";
    if (score >= 90) return "别名关键词匹配";
    if (score >= 70) return "名称包含匹配";
    return "相近名称匹配";
  }

  function renderResult(item, score, ranked) {
    const meta = categoryMeta[item.category];
    const related = relatedItems(item, ranked);
    $("#resultArea").innerHTML = `
      <article class="result-card category-${meta.slug}">
        <header class="result-head">
          <img src="${meta.icon}" alt="">
          <div class="result-head-copy">
            <span>${escapeHTML(meta.label)} · ${escapeHTML(matchLabel(score))}</span>
            <h3>${escapeHTML(item.name)}</h3>
            <p>${escapeHTML(item.category)}｜${escapeHTML(meta.short)}</p>
          </div>
        </header>
        <div class="result-details">
          <div class="detail-item">
            <span class="detail-number">01</span>
            <div><strong>投放建议</strong><p>${escapeHTML(item.suggestion)}</p></div>
          </div>
          <div class="detail-item">
            <span class="detail-number">02</span>
            <div><strong>分类原因</strong><p>${escapeHTML(item.reason)}</p></div>
          </div>
          <div class="detail-item wide">
            <span class="detail-number">03</span>
            <div><strong>注意事项</strong><p>${escapeHTML(item.note)}</p></div>
          </div>
        </div>
        <div class="related-row">
          <span>相似查询</span>
          ${related.map((entry) => `<button type="button" data-related-query="${escapeHTML(entry.name)}">${escapeHTML(entry.name)}</button>`).join("")}
        </div>
      </article>
    `;
  }

  function renderNoResult(query, ranked) {
    const fallback = ranked.slice(0, 5).map((entry) => entry.item);
    const defaults = ["矿泉水瓶", "纸巾", "废电池", "苹果皮"].map((name) => data.find((item) => item.name === name)).filter(Boolean);
    const suggestions = fallback.length ? fallback : defaults;
    $("#resultArea").innerHTML = `
      <div class="no-result">
        <h3>暂未找到“${escapeHTML(query)}”</h3>
        <p>可以换一个更常见或更简短的名称，也可以从下面的建议中选择。</p>
        <div class="suggestion-buttons">
          ${suggestions.map((item) => `<button type="button" data-related-query="${escapeHTML(item.name)}">${escapeHTML(item.name)}</button>`).join("")}
        </div>
      </div>
    `;
  }

  function performSearch(rawQuery, { scroll = true } = {}) {
    const query = String(rawQuery || "").trim();
    if (!query) {
      showToast("请先输入一个垃圾名称");
      $("#mainSearchInput").focus();
      return null;
    }

    const ranked = rankItems(query);
    const best = ranked[0];
    if (!best || best.score < 50) {
      renderNoResult(query, ranked);
      if (scroll) $("#query").scrollIntoView({ behavior: "smooth", block: "start" });
      return null;
    }

    $("#mainSearchInput").value = query;
    renderResult(best.item, best.score, ranked);
    addHistory(best.item);
    if (scroll) $("#query").scrollIntoView({ behavior: "smooth", block: "start" });
    return best.item;
  }

  function activateQueryTab(tabName) {
    const isText = tabName === "text";
    $("#textTab").classList.toggle("active", isText);
    $("#imageTab").classList.toggle("active", !isText);
    $("#textTab").setAttribute("aria-selected", String(isText));
    $("#imageTab").setAttribute("aria-selected", String(!isText));
    $("#textPanel").hidden = !isText;
    $("#imagePanel").hidden = isText;
    $("#textPanel").classList.toggle("active", isText);
    $("#imagePanel").classList.toggle("active", !isText);
  }

  function queryFromButton(name) {
    activateQueryTab("text");
    $("#mainSearchInput").value = name;
    performSearch(name);
  }

  function renderPopular() {
    $("#popularList").innerHTML = popularNames.map((name) => `<button type="button" data-popular-query="${escapeHTML(name)}">${escapeHTML(name)}</button>`).join("");
  }

  function renderDatalist() {
    $("#garbageSuggestions").innerHTML = data.map((item) => `<option value="${escapeHTML(item.name)}"></option>`).join("");
    $("#dataCount").textContent = `${data.length}`;
  }

  function renderScene(scene) {
    const info = sceneInfo[scene];
    $("#sceneKicker").textContent = info.kicker;
    $("#sceneTitle").textContent = info.title;
    $("#sceneDescription").textContent = info.description;
    const sceneItems = data.filter((item) => item.scene === scene).slice(0, 6);
    $("#sceneItems").innerHTML = sceneItems.map((item) => `
      <button class="scene-item" type="button" data-scene-query="${escapeHTML(item.name)}">
        <div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.category)}</small></div><span aria-hidden="true">→</span>
      </button>
    `).join("");
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function removeImage() {
    $("#imageInput").value = "";
    $("#imagePreview").removeAttribute("src");
    $("#previewWrap").hidden = true;
    $("#uploadPrompt").hidden = false;
    $("#filenameHint").hidden = true;
    $("#filenameHint").innerHTML = "";
  }

  function inferFromFilename(filename) {
    const stem = filename.replace(/\.[^.]+$/, "").replace(/[\d_\-—()（）]+/g, " ").trim();
    if (!stem) return null;
    const ranked = rankItems(stem);
    return ranked[0] && ranked[0].score >= 55 ? ranked[0] : null;
  }

  function handleImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("请选择图片文件");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("图片不能超过 8 MB");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      $("#imagePreview").src = reader.result;
      $("#uploadPrompt").hidden = true;
      $("#previewWrap").hidden = false;
      $("#fileMeta").textContent = `${file.name} · ${formatFileSize(file.size)}`;
    });
    reader.readAsDataURL(file);

    const inferred = inferFromFilename(file.name);
    const hint = $("#filenameHint");
    if (inferred) {
      $("#imageNameInput").value = inferred.item.name;
      hint.innerHTML = `根据文件名，可能是 <button type="button" data-filename-query="${escapeHTML(inferred.item.name)}">${escapeHTML(inferred.item.name)}</button>。请确认后查看建议。`;
    } else {
      hint.textContent = "图片已加载。当前版本不自动识别画面内容，请输入或选择图片中的物品名称。";
    }
    hint.hidden = false;
  }

  function bindEvents() {
    $("#heroSearchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const query = $("#heroSearchInput").value;
      activateQueryTab("text");
      $("#mainSearchInput").value = query;
      performSearch(query);
    });

    $("#mainSearchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      performSearch($("#mainSearchInput").value, { scroll: false });
    });

    $("#imageAssistForm").addEventListener("submit", (event) => {
      event.preventDefault();
      performSearch($("#imageNameInput").value, { scroll: false });
    });

    $("#textTab").addEventListener("click", () => activateQueryTab("text"));
    $("#imageTab").addEventListener("click", () => activateQueryTab("image"));

    $("#imageInput").addEventListener("change", (event) => handleImage(event.target.files[0]));
    $("#removeImageButton").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeImage();
    });

    const dropZone = $("#dropZone");
    ["dragenter", "dragover"].forEach((type) => dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((type) => dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    }));
    dropZone.addEventListener("drop", (event) => handleImage(event.dataTransfer.files[0]));

    $("#clearHistoryButton").addEventListener("click", () => {
      history = [];
      saveHistory();
      renderHistory();
      showToast("查询历史已清空");
    });

    $$(".scene-tab").forEach((button) => button.addEventListener("click", () => {
      $$(".scene-tab").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      renderScene(button.dataset.scene);
    }));

    document.addEventListener("click", (event) => {
      const queryButton = event.target.closest("[data-popular-query], [data-history-query], [data-related-query], [data-guide-query], [data-scene-query], [data-filename-query]");
      if (!queryButton) return;
      const query = queryButton.dataset.popularQuery
        || queryButton.dataset.historyQuery
        || queryButton.dataset.relatedQuery
        || queryButton.dataset.guideQuery
        || queryButton.dataset.sceneQuery
        || queryButton.dataset.filenameQuery;
      queryFromButton(query);
    });

    const navToggle = $(".nav-toggle");
    const nav = $("#mainNav");
    navToggle.addEventListener("click", () => {
      const expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("open", !expanded);
    });
    $$("a", nav).forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }));
  }

  function initialize() {
    if (!data.length) {
      $("#resultArea").innerHTML = '<div class="no-result"><h3>知识库加载失败</h3><p>请确认 garbage-data.js 与页面位于同一文件夹。</p></div>';
      return;
    }
    renderDatalist();
    renderPopular();
    renderHistory();
    renderScene("宿舍");
    bindEvents();
  }

  initialize();
})();
