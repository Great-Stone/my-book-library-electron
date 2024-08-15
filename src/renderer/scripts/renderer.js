const { ipcRenderer } = require('electron');

document.getElementById('addBookForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const isbnCode = document.getElementById('isbnCode').value;
  const isbnAdditional = document.getElementById('isbnAdditional').value;
  const title = document.getElementById('title').value;
  const author = document.getElementById('author').value;
  const publisher = document.getElementById('publisher').value;
  const price = document.getElementById('price').value;
  const publicationDate = document.getElementById('publicationDate').value;
  const additionDate = new Date().toISOString();  // 현재 시간

  const book = { isbnCode, isbnAdditional, title, author, publisher, price, publicationDate, additionDate };

  ipcRenderer.send('add-book', book);

  ipcRenderer.on('add-book-response', (event, response) => {
    if (response.success) {
      alert('Book added successfully!');
    } else {
      alert('Failed to add book: ' + response.error);
    }
  });
});
