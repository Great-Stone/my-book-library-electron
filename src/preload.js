// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fetchSearchResults: (query) => ipcRenderer.invoke('fetch-search-results', query),
  fetchBookData: (isbn) => ipcRenderer.invoke('fetch-book-data', isbn),
  getBooks: (page) => ipcRenderer.invoke('get-books', page),
  getTotalCount: () => ipcRenderer.invoke('get-total-count'),
  deleteBook: (isbn) => ipcRenderer.invoke('delete-book', isbn),
  downloadCsv: () => ipcRenderer.invoke('download-csv'),
  getDbPath: () => ipcRenderer.invoke('get-db-path')  
});
