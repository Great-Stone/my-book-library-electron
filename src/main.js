const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      baseURLForDataURLs: path.join(__dirname, 'renderer'),
      scrollBounce: true,

    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'books.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (event) => {
    mainWindow.destroy()
  })

  mainWindow.on('closed', function () {
    mainWindow.destroy()
  });
}

// 현재 날짜와 시간을 ISO 8601 형식으로 반환하는 함수
function getFormattedDate() {
  const now = new Date();
  const offset = 9 * 60 * 60 * 1000; // 한국 시간은 UTC+9
  const koreanTime = new Date(now.getTime() + offset);

  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  const day = String(koreanTime.getDate()).padStart(2, '0');
  const hours = String(koreanTime.getHours()).padStart(2, '0');
  const minutes = String(koreanTime.getMinutes()).padStart(2, '0');
  const seconds = String(koreanTime.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
}

// IPC 핸들러들
ipcMain.handle('fetch-book-data', async (event, isbn) => {
  const cleanedIsbn = isbn.replace(/[-()]/g, '');

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM books WHERE isbnCode = ?', [cleanedIsbn], async (err, row) => {
      if (err) {
        console.log(err);
        reject({ success: false, message: 'Error querying database' });
        return;
      }

      if (row) {
        // 이미 존재하는 책 반환
        resolve({ success: false, message: 'Book already exists', book: row });
      } else {
        try {
          const url = `https://nl.go.kr/seoji/contents/S80100000000.do?schM=intgr_detail_view_isbn&isbn=${isbn}`;
          const { data } = await axios.get(url);
          const $ = cheerio.load(data);

          const bookInfoDiv = $('.resultBookInfo');

          const isbnText = bookInfoDiv.find('li:contains("ISBN") div').text().trim();
          const match = isbnText.match(/\(([^)]+)\)/);
          let isbnAdditional = '';
          if (match) {
            isbnAdditional = match[1];
          }

          const title = $('.resultViewDetail .tit').text().trim().replace(/[\r\n]+/g, ' ');
          const author = bookInfoDiv.find('li:contains("저자") div').text().trim();

          let publisher = bookInfoDiv.find('li:contains("발행처") div').text().trim().replace(/[\r\n]+/g, ' ');
          publisher = publisher.replace(/- 홈페이지 바로가기\s*$/, '').trim();

          const price = bookInfoDiv.find('li:contains("가격정보") div').text().trim();
          const publicationDate = bookInfoDiv.find('li:contains("발행(예정)일") div').text().trim();
          const additionDate = getFormattedDate();

          const book = {
            isbnCode: cleanedIsbn,
            isbnAdditional: isbnAdditional,
            title: title,
            author: author,
            publisher: publisher,
            price: price,
            publicationDate: publicationDate,
            additionDate: additionDate
          };

          db.run('INSERT INTO books (isbnCode, isbnAdditional, title, author, publisher, price, publicationDate, additionDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [book.isbnCode, book.isbnAdditional, book.title, book.author, book.publisher, book.price, book.publicationDate, book.additionDate],
            function (err) {
              if (err) {
                console.error('Error inserting into database:', err.message);
                reject({ success: false, message: 'Error inserting into database' });
              } else {
                resolve({ success: true, book: book });
              }
            });
        } catch (error) {
          console.error('Error fetching book data:', error);
          reject({ success: false, message: 'Error fetching book data' });
        }
      }
    });
  });
});

ipcMain.handle('get-total-count', () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM books', (err, row) => {
      if (err) {
        reject({ success: false, error: 'Error querying database' });
      } else {
        resolve({ success: true, totalCount: row.count });
      }
    });
  });
});

ipcMain.handle('get-books', (event, page = 1) => {
  const limit = 10;
  const offset = (page - 1) * limit;

  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM books ORDER BY additionDate DESC LIMIT ? OFFSET ?', [limit, offset], (err, rows) => {
      if (err) {
        reject({ success: false, error: 'Error querying database' });
      } else {
        db.get('SELECT COUNT(*) AS count FROM books', (err, row) => {
          if (err) {
            reject({ success: false, error: 'Error querying database' });
          } else {
            const totalBooks = row.count;
            const totalPages = Math.ceil(totalBooks / limit);
            resolve({
              success: true,
              books: rows,
              currentPage: page,
              totalPages: totalPages
            });
          }
        });
      }
    });
  });
});

ipcMain.handle('delete-book', (event, isbn) => {
  const cleanedIsbn = isbn.replace(/[-()]/g, '');

  return new Promise((resolve, reject) => {
    db.run('DELETE FROM books WHERE isbnCode = ?', [cleanedIsbn], function (err) {
      if (err) {
        reject({ success: false, message: 'Error deleting book' });
      } else if (this.changes === 0) {
        resolve({ success: false, message: 'Book not found' });
      } else {
        resolve({ success: true, message: 'Book deleted successfully' });
      }
    });
  });
});

ipcMain.handle('fetch-search-results', (event, query) => {
  const sql = `
    SELECT * FROM books
    WHERE title LIKE ? OR author LIKE ? OR publisher LIKE ? OR isbnCode LIKE ?
  `;
  const params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject({ success: false, message: 'Error querying database' });
      } else {
        resolve({ success: true, books: rows });
      }
    });
  });
});

ipcMain.handle('download-csv', () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM books', [], (err, rows) => {
      if (err) {
        reject({ success: false, error: 'Error querying database' });
      } else {
        const csvHeader = 'ISBN,Title,Author,Publisher,Price,Publication Date,Addition Date\n';
        const csvRows = rows.map(row => [
          `"${row.isbnCode}"`,
          `"${row.title}"`,
          `"${row.author}"`,
          `"${row.publisher}"`,
          `"${row.price}"`,
          `"${row.publicationDate}"`,
          `"${row.additionDate}"`
        ].join(',')).join('\n');

        const csvContent = csvHeader + csvRows;

        const defaultPath = app.getPath('documents');
        const defaultFileName =  'books.csv';

        let customURL = dialog.showSaveDialogSync({
          defaultPath: `${defaultPath}/${defaultFileName}`
        })

        // 파일 저장
        if (customURL) {
          fs.writeFile(customURL, csvContent, 'utf8', (err) => {
            if (err) {
              reject({ success: false, error: 'Error saving file' });
            } else {
              resolve({ success: true, message: 'File saved successfully' });
            }
          });
        } else {
          resolve({ success: false, error: 'Save dialog was cancelled' });
        }
      }
    });
  });
});

ipcMain.handle('get-db-path', () => {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');

  dialog.showMessageBoxSync({
    type: 'info',
    title: 'Database Info',
    textWidth: 400,
    message: `DB Directory: ${dbDir}`
  });
});

app.whenReady().then(() => {
  // 사용자 데이터 경로를 얻음
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');

  // 디렉토리가 존재하지 않으면 생성
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
  }

  // SQLite 데이터베이스 초기화
  const dbPath = path.join(dbDir, 'books.db');
  console.log('Database path:', dbPath);

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Could not connect to SQLite database:', err.message);
    } else {
      db.run(`CREATE TABLE IF NOT EXISTS books (
        isbnCode TEXT PRIMARY KEY,
        isbnAdditional TEXT,
        title TEXT,
        author TEXT,
        publisher TEXT,
        price TEXT,
        publicationDate TEXT,
        additionDate DATETIME
      )`);
    }
  });

  createWindow();

  app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
      }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
      app.quit();
  }
});
