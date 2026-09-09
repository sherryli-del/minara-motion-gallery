(() => {
  const data = window.MINARA_GALLERY;
  const state = {
    project: 'all',
    view: 'latest',
    query: '',
    selected: new Set(),
    active: null,
  };

  const els = {
    filters: document.querySelector('#projectFilters'),
    stats: document.querySelector('#stats'),
    search: document.querySelector('#searchInput'),
    gallery: document.querySelector('#gallery'),
    count: document.querySelector('#resultCount'),
    clear: document.querySelector('#clearButton'),
    empty: document.querySelector('#emptyState'),
    theme: document.querySelector('#themeButton'),
    selectionBar: document.querySelector('#selectionBar'),
    selectionCount: document.querySelector('#selectionCount'),
    copySelected: document.querySelector('#copySelected'),
    clearSelected: document.querySelector('#clearSelected'),
    dialog: document.querySelector('#previewDialog'),
    dialogProject: document.querySelector('#dialogProject'),
    dialogTitle: document.querySelector('#dialogTitle'),
    dialogVideo: document.querySelector('#dialogVideo'),
    dialogMeta: document.querySelector('#dialogMeta'),
    closeDialog: document.querySelector('#closeDialog'),
    dialogCopyPrompt: document.querySelector('#dialogCopyPrompt'),
    dialogCopySource: document.querySelector('#dialogCopySource'),
    dialogCopyVideo: document.querySelector('#dialogCopyVideo'),
    toast: document.querySelector('#toast'),
  };

  const encodedPath = (relative) => relative.split('/').map(encodeURIComponent).join('/');
  const localPath = (relative) => `${data.rootDir}/${relative}`;
  const sourceLocation = (relative) => data.public
    ? `${data.repoBase}/blob/main/${encodedPath(relative)}`
    : localPath(relative);
  const videoLocation = (relative) => data.public
    ? `${data.rawBase}/${encodedPath(relative)}`
    : localPath(relative);
  const mediaUrl = (relative) => data.public
    ? videoLocation(relative)
    : `../${encodedPath(relative)}`;
  const formatDuration = (seconds) => {
    if (!seconds) return '时长未知';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60).toString().padStart(2, '0');
    return mins ? `${mins}:${secs}` : `${Number(seconds.toFixed(1))}s`;
  };
  const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
  const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[char]));

  function reusePrompt(entries) {
    const lines = entries.map((entry) => {
      const source = entry.source ? sourceLocation(entry.source) : '未匹配到独立源码页';
      return `- 镜头：${entry.title}\n  视频：${videoLocation(entry.file)}\n  源码：${source}`;
    }).join('\n');
    return `请参考并复用以下 Minara 镜头的动画语言。只继承运动结构、镜头节奏和动画参数，不直接沿用原品牌、文案、Logo、产品截图、字体或音乐。先说明准备抽取哪些动画机制及素材依赖，再适配到我的新内容。\n\n${lines}`;
  }

  async function copyText(text, message = '已复制') {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      showToast(message);
    }
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function projectCounts() {
    const base = state.view === 'latest' ? data.entries.filter((entry) => entry.isLatest) : data.entries;
    const counts = new Map();
    for (const entry of base) counts.set(entry.projectId, (counts.get(entry.projectId) || 0) + 1);
    return counts;
  }

  function renderFilters() {
    const counts = projectCounts();
    const baseCount = state.view === 'latest' ? data.stats.shots : data.stats.renders;
    const buttons = [{id: 'all', name: '全部项目', count: baseCount}, ...data.projects
      .filter((project) => counts.has(project.id))
      .map((project) => ({id: project.id, name: project.name, count: counts.get(project.id)}))];
    els.filters.innerHTML = buttons.map((item) => `
      <button class="filter-button ${state.project === item.id ? 'active' : ''}" type="button" data-project="${item.id}">
        <span>${escapeHtml(item.name)}</span><span>${item.count}</span>
      </button>`).join('');
  }

  function renderStats() {
    const stats = [
      ['镜头组', data.stats.shots],
      ['渲染版本', data.stats.renders],
      ['源码页面', data.stats.sourcePages],
    ];
    els.stats.innerHTML = stats.map(([label, value]) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  }

  function filteredEntries() {
    const query = state.query.trim().toLowerCase();
    return data.entries.filter((entry) => {
      if (state.view === 'latest' && !entry.isLatest) return false;
      if (state.project !== 'all' && entry.projectId !== state.project) return false;
      if (!query) return true;
      return [entry.title, entry.file, entry.project, entry.source || ''].some((value) => value.toLowerCase().includes(query));
    });
  }

  function cardMarkup(entry) {
    const resolution = entry.width && entry.height ? `${entry.width}×${entry.height}` : '尺寸未知';
    const cover = entry.thumbnail
      ? `<img src="${entry.thumbnail}" alt="${escapeHtml(entry.title)} 的视频画面" loading="lazy">`
      : `<video class="thumb-video" src="${mediaUrl(entry.file)}#t=0.2" muted playsinline preload="metadata" aria-label="${escapeHtml(entry.title)} 的视频画面"></video>`;
    return `
      <article class="shot-card" data-id="${entry.id}">
        <button class="media-button" type="button" data-action="preview" aria-label="预览 ${escapeHtml(entry.title)}">
          ${cover}
          <video class="preview-video" muted loop playsinline preload="none"></video>
          <span class="play-label">播放预览</span>
        </button>
        <div class="card-body">
          <div class="card-title-row">
            <h2 class="card-title">${escapeHtml(entry.title)}</h2>
            <input class="select-shot" type="checkbox" aria-label="选择 ${escapeHtml(entry.title)}" ${state.selected.has(entry.id) ? 'checked' : ''}>
          </div>
          <p class="meta"><span>${escapeHtml(entry.projectShort)}</span><span>${formatDuration(entry.duration)}</span><span>${resolution}</span><span>${entry.versions} 个版本</span></p>
          <p class="path">${escapeHtml(entry.source || entry.file)}</p>
          <div class="card-actions">
            <button type="button" data-action="preview">放大预览</button>
            <button class="copy-button" type="button" data-action="copy">复制复用指令</button>
          </div>
        </div>
      </article>`;
  }

  function bindCard(card, entry) {
    const mediaButton = card.querySelector('.media-button');
    const video = card.querySelector('.preview-video');
    const label = card.querySelector('.play-label');
    let loaded = false;

    const startPreview = () => {
      if (!loaded) {
        video.src = mediaUrl(entry.file);
        loaded = true;
      }
      mediaButton.classList.add('is-playing');
      label.textContent = '点击放大';
      video.play().catch(() => {});
    };
    const stopPreview = () => {
      video.pause();
      mediaButton.classList.remove('is-playing');
      label.textContent = '播放预览';
    };

    card.addEventListener('mouseenter', startPreview);
    card.addEventListener('mouseleave', stopPreview);
    card.addEventListener('focusin', (event) => {
      if (event.target.closest('.media-button')) startPreview();
    });
    card.querySelectorAll('[data-action="preview"]').forEach((button) => button.addEventListener('click', () => openDialog(entry)));
    card.querySelector('[data-action="copy"]').addEventListener('click', () => copyText(reusePrompt([entry]), '复用指令已复制'));
    card.querySelector('.select-shot').addEventListener('change', (event) => {
      if (event.target.checked) state.selected.add(entry.id);
      else state.selected.delete(entry.id);
      renderSelection();
    });
  }

  function renderGallery() {
    const entries = filteredEntries();
    els.gallery.innerHTML = entries.map(cardMarkup).join('');
    els.count.textContent = `显示 ${entries.length} 个${state.view === 'latest' ? '镜头' : '版本'}`;
    els.empty.hidden = entries.length !== 0;
    els.gallery.hidden = entries.length === 0;
    els.gallery.querySelectorAll('.shot-card').forEach((card) => {
      const entry = data.entries.find((item) => item.id === card.dataset.id);
      bindCard(card, entry);
    });
  }

  function renderSelection() {
    const count = state.selected.size;
    els.selectionBar.hidden = count === 0;
    els.selectionCount.textContent = `已选 ${count} 个镜头`;
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    renderFilters();
    renderGallery();
  }

  function openDialog(entry) {
    state.active = entry;
    els.dialogProject.textContent = entry.project;
    els.dialogTitle.textContent = entry.title;
    els.dialogVideo.src = mediaUrl(entry.file);
    els.dialogVideo.poster = entry.thumbnail || '';
    els.dialogMeta.innerHTML = `
      <div><strong>视频</strong><br>${escapeHtml(videoLocation(entry.file))}</div>
      <div><strong>源码</strong><br>${escapeHtml(entry.source ? sourceLocation(entry.source) : '未自动匹配')}</div>
      <div><strong>时长</strong><br>${formatDuration(entry.duration)}</div>
      <div><strong>尺寸</strong><br>${entry.width || '?'} × ${entry.height || '?'}</div>`;
    els.dialogCopySource.disabled = !entry.source;
    els.dialog.showModal();
    els.dialogVideo.play().catch(() => {});
  }

  function closeDialog() {
    els.dialogVideo.pause();
    els.dialogVideo.removeAttribute('src');
    els.dialogVideo.load();
    els.dialog.close();
    state.active = null;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('minara-gallery-theme', theme);
    els.theme.textContent = theme === 'dark' ? '浅色模式' : '深色模式';
  }

  els.filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-project]');
    if (!button) return;
    state.project = button.dataset.project;
    renderFilters();
    renderGallery();
  });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  els.search.addEventListener('input', () => { state.query = els.search.value; renderGallery(); });
  els.clear.addEventListener('click', () => {
    state.project = 'all';
    state.query = '';
    els.search.value = '';
    renderFilters();
    renderGallery();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      els.search.focus();
    }
    if (event.key === 'Escape' && els.dialog.open) closeDialog();
  });
  els.theme.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  els.closeDialog.addEventListener('click', closeDialog);
  els.dialog.addEventListener('click', (event) => { if (event.target === els.dialog) closeDialog(); });
  els.dialogCopyPrompt.addEventListener('click', () => state.active && copyText(reusePrompt([state.active]), '复用指令已复制'));
  els.dialogCopySource.addEventListener('click', () => state.active?.source && copyText(sourceLocation(state.active.source), '源码位置已复制'));
  els.dialogCopyVideo.addEventListener('click', () => state.active && copyText(videoLocation(state.active.file), '视频位置已复制'));
  els.copySelected.addEventListener('click', () => {
    const entries = data.entries.filter((entry) => state.selected.has(entry.id));
    copyText(reusePrompt(entries), '所选镜头的复用指令已复制');
  });
  els.clearSelected.addEventListener('click', () => {
    state.selected.clear();
    renderGallery();
    renderSelection();
  });

  const savedTheme = localStorage.getItem('minara-gallery-theme');
  const preferredTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(savedTheme || preferredTheme);
  renderStats();
  renderFilters();
  renderGallery();
})();
