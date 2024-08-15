let currentPage = 1;  // 현재 페이지
const booksPerPage = 10;  // 페이지당 책의 수
let latestBook = null; // 변수 추가

// CSV 다운로드 버튼의 클릭 이벤트 추가
document.addEventListener('DOMContentLoaded', () => {
    // 총 개수를 표시하는 함수 호출
    displayTotalBooks();
    displayResultsAll();
});

const addonMapping = {
    '0': '총류',
    '1': '철학 심리학 윤리학',
    '2': '종교',
    '3': '사회과학',
    '4': '자연과학',
    '5': '기술과학',
    '6': '예술',
    '7': '언어',
    '8': '문학',
    '9': '역사 지리 관광'
};

document.getElementById('downloadCsvButton').addEventListener('click', function() {
    window.api.downloadCsv();
});

document.getElementById('getDbInfoButton').addEventListener('click', function() {
    window.api.getDbPath();
});

document.getElementById('findButton').addEventListener('click', function() {
    const text = document.getElementById('findInput').value;
    if (text) {
        fetchSearchResults(text);        
    } else {
        displayResultsAll();
    }
});

// 검색 입력란에서 엔터 키를 눌렀을 때 검색 버튼 클릭 이벤트 트리거
document.getElementById('findInput').addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();  // 폼 제출을 막습니다.
        document.getElementById('findButton').click();
    }
});

document.getElementById('searchButton').addEventListener('click', function() {
    const isbn = document.getElementById('isbnInput').value;
    if (isbn) {
        fetchBookData(isbn);
    } else {
        alert('Please enter an ISBN.');
    }
});

document.getElementById('isbnInput').addEventListener('paste', function(event) {
    if (event.clipboardData || window.clipboardData) {
        event.preventDefault();
        const clipboardData = (event.clipboardData || window.clipboardData).getData("text");
        const cleanedData = clipboardData.replace(/[^0-9]/g, ''); // 숫자만 남기기
        document.getElementById('isbnInput').value = cleanedData;
    }
});

// ISBN 입력란에서 엔터 키를 눌렀을 때 검색 버튼 클릭 이벤트 트리거
document.getElementById('isbnInput').addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();  // 폼 제출을 막습니다.
        document.getElementById('searchButton').click();
    }
});

// 검색어를 사용하여 서버에서 데이터를 가져오는 함수
function fetchSearchResults(query) {
    window.api.fetchSearchResults(query)
    .then(data => {
        if (data.success) {
            displaySearchResults(data.books);
        } else {
            alert(`${data.message}`);
        }
    });
}

// 검색 결과를 테이블에 표시하는 함수
function displaySearchResults(books) {
    const resultsTable = document.getElementById('resultsTable');
    const resultsBody = resultsTable.querySelector('tbody');
    resultsBody.innerHTML = '';

    if (books.length > 0) {
        books.forEach(book => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><button class="btn btn-danger btn-sm" onclick="deleteBook('${book.isbnCode}')"><i class="bi bi-trash3"></i></button></td>
                <td>${book.isbnCode}</td>
                <td>${formatAddon(book.isbnAdditional)}</td>
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${book.publisher}</td>
                <td>${book.price}</td>
                <td>${book.publicationDate}</td>
                <td>${book.additionDate}</td>
            `;
            resultsBody.appendChild(row);
        });
        resultsTable.style.display = 'table';  // Show the table
    } else {
        resultsTable.style.display = 'none';  // Hide the table if no results
        alert('No books found.');
    }
}

function fetchBookData(isbn) {
    const cleanedIsbn = isbn.replace(/[-()]/g, '');

    const searchButton = document.getElementById('searchButton');
    const searchSpinner = document.getElementById('searchSpinner');

    // 버튼 비활성화 및 스피너 표시
    searchButton.disabled = true;
    searchSpinner.classList.remove('d-none');

    window.api.fetchBookData(isbn)
    .then(data => {
        if (data.success) {
            latestBook = data.book;
            displayResultsAll();
            displayLatestBook();  // Display the latest added book
            displayTotalBooks();  // Update total books count
        } else {
            alert(`${data.message}`);
        }
    })
    .catch(error => console.error('Error fetching data:', error))
    .finally(() => {
        // 버튼 활성화 및 스피너 숨김
        searchButton.disabled = false;
        searchSpinner.classList.add('d-none');
    });
}

const addonReg = /[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/ ]/gim;
function formatAddon(addonOrg) {
    let result = 'Unknown'
    if (addonOrg != null) {
        let addon = addonOrg.replace(addonReg, "");
        if (!addon || addon.length < 3) {
            return addon; // 부가기호가 부족한 경우 그대로 반환
        }
        const categoryCode = addon[2]; // 세 번째 자리 숫자
        result =  addonMapping[categoryCode] || 'Unknown'; // 매핑된 의미 반환 또는 'Unknown'
    }    
    return result
}

function displayResultsAll() {
    window.api.getBooks(currentPage)
    .then(data => {
        const resultsTable = document.getElementById('resultsTable');
        const resultsBody = resultsTable.querySelector('tbody');
        resultsBody.innerHTML = '';

        if (data.books && data.books.length > 0) {
            data.books.forEach(book => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><button class="btn btn-danger btn-sm" onclick="deleteBook('${book.isbnCode}')"><i class="bi bi-trash3"></i></button></td>
                    <td>${book.isbnCode}</td>
                    <td>${formatAddon(book.isbnAdditional)}</td>
                    <td>${book.title}</td>
                    <td>${book.author}</td>
                    <td>${book.publisher}</td>
                    <td>${book.price}</td>
                    <td>${book.publicationDate}</td>
                    <td>${book.additionDate}</td>                        
                `;
                if (latestBook && latestBook.isbnCode === book.isbnCode) {
                    row.classList.add('table-success');  // Highlight new book
                }
                resultsBody.appendChild(row);
            });
            resultsTable.style.display = 'table';  // Show the table
            document.getElementById('downloadCsvButton').style.display = 'block';  // Show the download button
            setupPagination(data.currentPage, data.totalPages);
        } else {
            resultsTable.style.display = 'none';  // Hide the table
            document.getElementById('downloadCsvButton').style.display = 'none';  // Hide the download button
        }
    })
    .catch(error => console.error('Error fetching data:', error));
}

function setupPagination(page, totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    // "First" 버튼
    const firstPageItem = document.createElement('li');
    firstPageItem.classList.add('page-item');
    if (page === 1) {
        firstPageItem.classList.add('disabled');
    }
    firstPageItem.innerHTML = `<a class="page-link" href="#">First</a>`;
    firstPageItem.addEventListener('click', (e) => {
        e.preventDefault();
        if (page > 1) {
            currentPage = 1;  // 페이지 번호를 첫 페이지로 설정
            displayResultsAll();  // 페이지 내용 갱신
        }
    });
    pagination.appendChild(firstPageItem);

    // "Previous" 버튼
    const prevPageItem = document.createElement('li');
    prevPageItem.classList.add('page-item');
    if (page === 1) {
        prevPageItem.classList.add('disabled');
    }
    prevPageItem.innerHTML = `<a class="page-link" href="#">Previous</a>`;
    prevPageItem.addEventListener('click', (e) => {
        e.preventDefault();
        if (page > 1) {
            currentPage--;  // 페이지 번호 감소
            displayResultsAll();  // 페이지 내용 갱신
        }
    });
    pagination.appendChild(prevPageItem);

    // 중간 페이지 버튼들
    const maxPagesToShow = 10;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.classList.add('page-item');
        if (i === page) {
            pageItem.classList.add('active');
        }
        pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        pageItem.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;  // 페이지 번호 갱신
            displayResultsAll();  // 페이지 내용 갱신
        });
        pagination.appendChild(pageItem);
    }

    // "Next" 버튼
    const nextPageItem = document.createElement('li');
    nextPageItem.classList.add('page-item');
    if (page === totalPages) {
        nextPageItem.classList.add('disabled');
    }
    nextPageItem.innerHTML = `<a class="page-link" href="#">Next</a>`;
    nextPageItem.addEventListener('click', (e) => {
        e.preventDefault();
        if (page < totalPages) {
            currentPage++;  // 페이지 번호 증가
            displayResultsAll();  // 페이지 내용 갱신
        }
    });
    pagination.appendChild(nextPageItem);

    // "Last" 버튼
    const lastPageItem = document.createElement('li');
    lastPageItem.classList.add('page-item');
    if (page === totalPages) {
        lastPageItem.classList.add('disabled');
    }
    lastPageItem.innerHTML = `<a class="page-link" href="#">Last</a>`;
    lastPageItem.addEventListener('click', (e) => {
        e.preventDefault();
        if (page < totalPages) {
            currentPage = totalPages;  // 페이지 번호를 마지막 페이지로 설정
            displayResultsAll();  // 페이지 내용 갱신
        }
    });
    pagination.appendChild(lastPageItem);
}

function displayTotalBooks() {
    window.api.getTotalCount()
    .then(data => {
        document.getElementById('totalBooks').textContent = `Total Books: ${data.totalCount}`;
    })
    .catch(error => console.error('Error fetching total book count:', error));
}

function deleteBook(isbn) {
    const cleanedIsbn = isbn.replace(/[-()]/g, '');

    window.api.deleteBook(isbn)
    .then(() => {
        alert('Book deleted successfully.');
        displayResultsAll();
    })
    .catch(error => console.error('Error:', error));
}

function displayLatestBook() {
    if (latestBook) {
        const resultsTable = document.getElementById('resultsTable');
        const resultsBody = resultsTable.querySelector('tbody');

        // Highlight the latest book
        const rows = resultsBody.querySelectorAll('tr');
        rows.forEach(row => {
            const isbnCell = row.querySelector('td:nth-child(2)');
            if (isbnCell && isbnCell.textContent.trim() === latestBook.isbnCode) {
                row.classList.add('table-success');  // Add class to highlight the latest book
            }
        });
    }
}