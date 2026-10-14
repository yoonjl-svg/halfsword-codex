(() => {
  const items = JSON.parse(document.querySelector('#roster-data').textContent);
  const grid = document.querySelector('#roster'), dialog = document.querySelector('#detail');
  let current = 0, opener;
  function show(index) {
    current = (index + items.length) % items.length;
    const item = items[current], photo = document.querySelector('#detail-image');
    document.querySelector('#detail-name').textContent = item.name;
    photo.src = item.image; photo.alt = `${item.name} 정면 전신`;
    document.querySelector('#detail-epithet').textContent = item.epithet;
    document.querySelector('#detail-facts').textContent = [item.age === null ? (item.id === 'player' ? '' : '나이 미정') : `${item.age}세`, item.weapon, item.note].filter(Boolean).join(' · ');
    document.querySelector('#detail-origin').textContent = item.origin;
    document.querySelector('#position').textContent = `${current + 1} / ${items.length}`;
    document.querySelector('#original').href = item.image;
  }
  grid.addEventListener('click', event => {
    const link = event.target.closest('a[data-index]');
    if (!link || typeof dialog.showModal !== 'function' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); opener = link; show(Number(link.dataset.index));
    dialog.showModal(); document.body.classList.add('modal-open'); document.querySelector('#close').focus();
  });
  document.querySelector('#close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); opener?.focus({preventScroll:true}); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); show(current + (event.key === 'ArrowRight' ? 1 : -1)); }
  });
  document.querySelector('#prev').addEventListener('click', () => show(current - 1));
  document.querySelector('#next').addEventListener('click', () => show(current + 1));
  for (const mode of ['compact','large']) document.querySelector(`#${mode}`).addEventListener('click', () => {
    grid.classList.toggle('large', mode === 'large');
    for (const name of ['compact','large']) document.querySelector(`#${name}`).setAttribute('aria-pressed', String(name === mode));
  });
})();
