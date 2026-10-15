const input = document.querySelector('#search');
if (input) {
  const cards = [...document.querySelectorAll('[data-search]')];
  const count = document.querySelector('#results-count');
  const empty = document.querySelector('#no-results');
  input.addEventListener('input', () => {
    const words = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      card.hidden = !words.every(word => card.dataset.search.includes(word));
      if (!card.hidden) visible++;
    }
    count.textContent = `显示 ${visible} 项公开资料`;
    empty.hidden = visible !== 0;
  });
}
