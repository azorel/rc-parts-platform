const DATA_PATHS = {
  brands: "data/brands.json",
  creators: "data/creators.json",
  searchIndex: "data/search-index.json",
};

const DATA_CACHE = {
  brands: null,
  creators: null,
  searchIndex: null,
};

const state = {
  brands: null,
  creators: null,
  searchIndex: null,
};

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat("en-US").format(value);
}

async function fetchJson(path) {
  if (!path) return null;
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function ensureData(keys) {
  const missing = keys.filter((key) => state[key] === null);
  if (!missing.length) {
    return;
  }
  const results = await Promise.all(missing.map((key) => fetchJson(DATA_PATHS[key])));
  missing.forEach((key, index) => {
    state[key] = results[index];
  });
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name)?.toLowerCase();
}

function createBrandCard(brand) {
  const creators = brand.creators?.length ? `${brand.creators.length} creators` : "Creator data pending";
  return `
    <article class="card">
      <h3>${escapeHTML(brand.name)}</h3>
      <p>${formatNumber(brand.video_count)} video mentions</p>
      <p class="muted">${escapeHTML(creators)}</p>
      <div class="link-list" style="margin-top: auto;">
        <a class="link-pill" href="brand.html?brand=${encodeURIComponent(brand.slug)}">View brand</a>
        <a class="link-pill" href="search.html?q=${encodeURIComponent(brand.name)}">Search mentions</a>
      </div>
    </article>
  `;
}

function createCreatorCard(creator) {
  const latest = creator.latest_video;
  const subline = creator.brands?.length
    ? `${creator.brands.length} brands mentioned`
    : "Brand data pending";
  return `
    <article class="card">
      <h3>${escapeHTML(creator.name)}</h3>
      <p>${formatNumber(creator.video_count)} videos indexed</p>
      <p class="muted">${escapeHTML(subline)}</p>
      ${latest ? `<p class="video-meta">Latest: ${escapeHTML(latest.title)}</p>` : ""}
      <div class="link-list" style="margin-top: auto;">
        <a class="link-pill" href="creator.html?creator=${encodeURIComponent(creator.slug)}">Open creator</a>
        <a class="link-pill" href="search.html?q=${encodeURIComponent(creator.name)}">Search creator</a>
      </div>
    </article>
  `;
}

function createVideoCard(video, brandName, label = "") {
  return `
    <article class="video-card">
      <h4>${escapeHTML(video.title)}</h4>
      <p class="video-meta">${formatNumber(new Date(video.published_at || Date.now()).getFullYear())} • ${escapeHTML(brandName || "")} ${label}</p>
      <p>${escapeHTML(video.snippet || "No description yet.")}</p>
      ${video.url ? `<a href="${video.url}" target="_blank" rel="noreferrer">Watch on YouTube</a>` : ""}
    </article>
  
  `;
}

function renderHome() {
  const heroBrandCount = document.querySelector("[data-stat=brands]");
  const heroCreatorCount = document.querySelector("[data-stat=creators]");
  const heroIndexSize = document.querySelector("[data-stat=search]");
  const trendingContainer = document.getElementById("trending-brands");
  const creatorsContainer = document.getElementById("creator-cards");

  if (!state.brands || !state.creators) {
    return;
  }
  heroBrandCount.textContent = formatNumber(state.brands.length);
  heroCreatorCount.textContent = formatNumber(state.creators.length);
  heroIndexSize.textContent = formatNumber(state.searchIndex?.length ?? 0);

  const trending = [...state.brands]
    .sort((a, b) => (b.video_count || 0) - (a.video_count || 0))
    .slice(0, 6);
  const topBrandNode = document.getElementById("hero-top-brand");
  if (topBrandNode) {
    topBrandNode.textContent = trending[0]?.name || "—";
  }
  trendingContainer.innerHTML = trending.map((brand) => createBrandCard(brand)).join("");

  const freshContainer = document.getElementById("fresh-videos");
  if (freshContainer && state.creators) {
    const freshList = state.creators
      .filter((creator) => creator.latest_video)
      .map((creator) => ({ ...creator.latest_video, creatorName: creator.name }))
      .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))
      .slice(0, 4);
    if (freshList.length) {
      freshContainer.innerHTML = freshList
        .map((video) => createVideoCard(video, video.creatorName, "• Latest upload"))
        .join("");
    } else {
      freshContainer.innerHTML = "<p class='no-results'>No fresh uploads yet.</p>";
    }
  }

  const featuredCreators = [...state.creators]
    .sort((a, b) => (b.video_count || 0) - (a.video_count || 0))
    .slice(0, 6);
  creatorsContainer.innerHTML = featuredCreators.map((creator) => createCreatorCard(creator)).join("");
}

function renderBrandsList() {
  const filterInput = document.getElementById("brand-filter");
  const listContainer = document.getElementById("brand-list");
  const countNode = document.getElementById("brand-count");

  if (!state.brands) {
    return;
  }

  const query = filterInput?.value.trim().toLowerCase() || "";
  const results = state.brands.filter((entry) => {
    if (!query) return true;
    return (
      entry.name.toLowerCase().includes(query) ||
      entry.creators?.some((c) => c.toLowerCase().includes(query))
    );
  });
  countNode.textContent = `${results.length} brands`;
  listContainer.innerHTML = results.map((brand) => createBrandCard(brand)).join("");
}


function lookupCreatorSlug(name) {
  if (!name) {
    return slugify(name);
  }
  if (state.creators?.length) {
    const normalized = name.toLowerCase();
    const match = state.creators.find((entry) => entry.name.toLowerCase() === normalized);
    if (match) {
      return match.slug;
    }
  }
  return slugify(name);
}

function renderBrandDetail() {
  const slug = getQueryParam("brand");
  const container = document.getElementById("brand-detail");
  const list = document.getElementById("brand-videos-list");
  const header = document.getElementById("brand-page-title");

  if (!slug || !state.brands) {
    container.innerHTML = "<p class='no-results'>No brand selected or data still loading.</p>";
    return;
  }
  const brand = state.brands.find((entry) => entry.slug === slug);
  if (!brand) {
    container.innerHTML = `<p class='no-results'>We could not find that brand yet. Try another one or search the platform.</p>`;
    return;
  }
  header.textContent = `${brand.name}`;
  container.innerHTML = `
    <h2>${escapeHTML(brand.name)}</h2>
    <p>${formatNumber(brand.video_count)} videos mention this brand.</p>
    <div class="link-list">
      ${brand.creators.map((creator) => `<a class="link-pill" href="creator.html?creator=${encodeURIComponent(lookupCreatorSlug(creator))}">${escapeHTML(creator)}</a>`).join("")}
    </div>
    <p class="muted" style="margin-top: 0.5rem;">Showing the freshest ${brand.videos.length} mentions from the creators we track.</p>
  `;
  if (!brand.videos?.length) {
    list.innerHTML = "<p class='no-results'>No video mentions yet for this brand.</p>";
    return;
  }
  list.innerHTML = brand.videos.map((video) => createVideoCard(video, brand.name)).join("");
}

function renderCreatorDetail() {
  const slug = getQueryParam("creator");
  const container = document.getElementById("creator-detail");
  const list = document.getElementById("creator-videos-list");

  if (!slug || !state.creators) {
    container.innerHTML = "<p class='no-results'>No creator selected or data still loading.</p>";
    return;
  }
  const creator = state.creators.find((entry) => entry.slug === slug);
  if (!creator) {
    container.innerHTML = `<p class='no-results'>Creator not found yet. Try another name or search the full index.</p>`;
    list.innerHTML = "";
    return;
  }
  const brandsList = creator.brands?.length
    ? creator.brands
        .map((brand) => `<a class="link-pill" href="brand.html?brand=${encodeURIComponent(slugify(brand))}">${escapeHTML(brand)}</a>`)
        .join("")
    : "No brand mentions yet.";
  container.innerHTML = `
    <h2>${escapeHTML(creator.name)}</h2>
    <p>${formatNumber(creator.video_count)} videos harvested.</p>
    <div class="link-list">${brandsList}</div>
    <p class="muted" style="margin-top: 0.7rem;">Latest indexed video: ${escapeHTML(creator.latest_video?.title || "Pending upload" )}</p>
  `;
  if (!creator.videos?.length) {
    list.innerHTML = "<p class='no-results'>No videos cached yet.</p>";
    return;
  }
  list.innerHTML = creator.videos.map((video) => createVideoCard(video, creator.name, "• Creator")).join("");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderSearchPage() {
  const queryInput = document.getElementById("search-page-input");
  const resultsContainer = document.getElementById("search-results");
  const queryLabel = document.getElementById("search-query-label");
  const query = queryInput?.value.trim() || "";
  if (!state.searchIndex) {
    resultsContainer.innerHTML = "<p class='no-results'>Search data is loading...</p>";
    return;
  }
  if (queryLabel) {
    queryLabel.textContent = query ? `Results for "${query}"` : "Try searching for brands, creators, or products.";
  }
  if (!query) {
    resultsContainer.innerHTML = "";
    return;
  }
  const normalized = query.toLowerCase();
  const matches = state.searchIndex.filter((item) => {
    const haystack = `${item.name} ${item.creator ?? ""} ${item.brand ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  });
  if (!matches.length) {
    resultsContainer.innerHTML = `<p class="no-results">No results for "${escapeHTML(query)}".</p>`;
    return;
  }
  resultsContainer.innerHTML = matches
    .slice(0, 80)
    .map((item) => {
      const label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
      const meta = [];
      if (item.video_count) {
        meta.push(`${formatNumber(item.video_count)} videos`);
      }
      if (item.creator) {
        meta.push(`Creator: ${escapeHTML(item.creator)}`);
      }
      if (item.brand) {
        meta.push(`Brand: ${escapeHTML(item.brand)}`);
      }
      const metaLine = meta.join(" • ");
      return `
        <article class="card">
          <h3>${escapeHTML(item.name)}</h3>
          <p class="muted">${label}${metaLine ? ` • ${metaLine}` : ""}</p>
          <div class="link-list">
            <a class="link-pill" href="${item.link}">View</a>
            <a class="link-pill" href="search.html?q=${encodeURIComponent(item.name)}">Refine</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function attachFilters() {
  const brandFilter = document.getElementById("brand-filter");
  if (brandFilter) {
    brandFilter.addEventListener("input", () => renderBrandsList());
  }
  const searchInput = document.getElementById("search-page-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => renderSearchPage());
  }
  const searchForm = document.getElementById("search-page-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = searchInput?.value.trim() || "";
      if (value) {
        window.location.search = `?q=${encodeURIComponent(value)}`;
      }
    });
  }
  const heroSearch = document.getElementById("home-search");
  if (heroSearch) {
    heroSearch.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = heroSearch.querySelector("input")?.value.trim() || "";
      if (value) {
        window.location.href = `search.html?q=${encodeURIComponent(value)}`;
      }
    });
  }
  
  // Attach compatibility filter listeners
  const platformFilter = document.getElementById("filter-platform");
  const scaleFilter = document.getElementById("filter-scale");
  if (platformFilter) {
    platformFilter.addEventListener("change", applyFilters);
  }
  if (scaleFilter) {
    scaleFilter.addEventListener("change", applyFilters);
  }
}

function applySearchParam() {
  const input = document.getElementById("search-page-input");
  const param = new URLSearchParams(window.location.search).get("q") || "";
  if (input) {
    input.value = param;
  }
}

function applyFilters() {
  const platformFilter = document.getElementById("filter-platform")?.value || "";
  const scaleFilter = document.getElementById("filter-scale")?.value || "";
  
  // Filter trending brands by platform and scale
  const trendingContainer = document.getElementById("trending-brands");
  if (trendingContainer) {
    const cards = trendingContainer.querySelectorAll(".card");
    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      const platformMatch = !platformFilter || text.includes(platformFilter.toLowerCase());
      const scaleMatch = !scaleFilter || text.includes(scaleFilter);
      card.style.display = platformMatch && scaleMatch ? "" : "none";
    });
  }
  
  // Store filter state in URL for persistence
  const params = new URLSearchParams();
  if (platformFilter) params.set("platform", platformFilter);
  if (scaleFilter) params.set("scale", scaleFilter);
  window.history.replaceState({}, "", `?${params.toString()}`);
}

function clearFilters() {
  document.getElementById("filter-platform").value = "";
  document.getElementById("filter-scale").value = "";
  
  // Show all cards
  const trendingContainer = document.getElementById("trending-brands");
  if (trendingContainer) {
    trendingContainer.querySelectorAll(".card").forEach((card) => {
      card.style.display = "";
    });
  }
  
  window.history.replaceState({}, "", window.location.pathname);
}

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  const root = document.documentElement;
  const stored = localStorage.getItem("rc-theme");
  if (stored === "light") {
    root.classList.add("light");
  }
  const updateLabel = () => {
    toggle.textContent = root.classList.contains("light") ? "🌞" : "🌙";
  };
  toggle.addEventListener("click", () => {
    root.classList.toggle("light");
    localStorage.setItem("rc-theme", root.classList.contains("light") ? "light" : "dark");
    updateLabel();
  });
  updateLabel();
}

async function init() {
  setupThemeToggle();
  attachFilters();
  applySearchParam();
  const page = document.body.dataset.page;
  try {
    if (page === "home") {
      await ensureData(["brands", "creators", "searchIndex"]);
      renderHome();
    } else if (page === "brands") {
      await ensureData(["brands"]);
      renderBrandsList();
    } else if (page === "brand-detail") {
      await ensureData(["brands", "creators"]);
      renderBrandDetail();
    } else if (page === "creator-detail") {
      await ensureData(["creators"]);
      renderCreatorDetail();
    } else if (page === "search") {
      await ensureData(["searchIndex"]);
      renderSearchPage();
    }
  } catch (err) {
    console.error(err);
    const main = document.querySelector("main");
    if (main) {
      main.innerHTML = `<p class="no-results">There was an issue loading the data. Try again in a moment.</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
