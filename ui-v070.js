(() => {
  document.documentElement.dataset.mesraahLegacyUi = 'retired';
  document.documentElement.classList.add('mesraah-home-booting');

  const style = document.createElement('style');
  style.id = 'mesraahFirstPaintGuard';
  style.textContent = `
    html.mesraah-home-booting #view-today > * { visibility:hidden !important; }
    html.mesraah-home-booting #view-today { min-height:72vh; position:relative; }
    html.mesraah-home-booting #view-today::before {
      content:'مِسْرَاح'; position:absolute; inset:22px 0 auto 0; margin:auto; width:max-content;
      color:#0d3656; font-weight:900; font-size:1.15rem; letter-spacing:.01em;
    }
    html.mesraah-home-booting #view-today::after {
      content:''; position:absolute; top:64px; right:50%; width:34px; height:34px; margin-right:-17px;
      border:3px solid rgba(13,54,86,.13); border-top-color:#0d3656; border-radius:50%;
      animation:mesraahBootSpin .75s linear infinite;
    }
    @keyframes mesraahBootSpin { to { transform:rotate(360deg); } }
  `;
  document.head.appendChild(style);

  const release = () => {
    document.documentElement.classList.remove('mesraah-home-booting');
    style.remove();
  };
  window.addEventListener('mesraah:home-ready', release, { once:true });
  window.setTimeout(release, 3500);
})();
