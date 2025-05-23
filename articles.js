/*
  Copyright 2025 Imago Veritatis (Timoh de Solarys)

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { getFirestore, collection, getDocs, query, orderBy, startAfter, limit } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { toHTML } from "https://cdn.jsdelivr.net/npm/@odiffey/discord-markdown@3.3.0/+esm";

const firebaseConfig = {
    apiKey: "AIzaSyCaexv-0SVEmPeRNYt-WviKBiUhH-Ju7XQ",
    authDomain: "imago-veritatis.firebaseapp.com",
    projectId: "imago-veritatis",
    storageBucket: "imago-veritatis.firebasestorage.app",
    messagingSenderId: "119028191334",
    appId: "1:119028191334:web:44815ae6a51aac8d959da7",
    measurementId: "G-DGMLVJ767X"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const categoryFilter = document.getElementById("categoryFilter");
const toggleButton = document.getElementById('dropdownToggle');
const dropdownMenu = document.getElementById('dropdownMenu');
const pageSize = 10;
const placeholderCount = 5;
let lastVisibleDoc = null;
let isLoading = false;
let hasMore = true;
const articlesContainer = document.getElementById("articles-container");
const sentinel = document.createElement("div");
let allArticles = [];
const categoriesSet = new Set();

toggleButton.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.style.display = (dropdownMenu.style.display === 'block') ? 'none' : 'block';
});

window.addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
});

dropdownMenu.addEventListener('click', (e) => {
    e.stopPropagation();
});

async function setLastArticleLink() {
    const articlesRef = collection(db, 'articles');
    const q = query(articlesRef, orderBy('realTimestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const link = document.getElementById('lastArticleLink');
        link.href = `article.html?id=${docSnap.id}`;
    }
}

setLastArticleLink();

categoryFilter.addEventListener("change", () => {
    const selected = categoryFilter.value;
    const articlesToDisplay = selected === "all"
        ? allArticles
        : allArticles.filter(a => a.category === selected);
    displayArticlesFromList(articlesToDisplay);
});

function displayArticlesFromList(list) {
    articlesContainer.innerHTML = "";
    list.forEach(article => {
        const el = document.createElement("div");
        el.classList.add("article-card");
        el.innerHTML = `
            <a href="article.html?id=${article.id}" class="article-link">
                <h2>${article.title}</h2>
                <p>Auteur : ${article.author} - Publié le : ${article.dateStr} - Catégorie : ${article.category}</p>
                <div>${article.previewHTML}...</div>
                ${article.meme ? `<img src="${article.meme}" alt="Meme" class="article-image">` : ''}
            </a>
        `;
        articlesContainer.appendChild(el);
    });
}

sentinel.id = "scroll-sentinel";
articlesContainer.after(sentinel);

function createPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.classList.add("article-card", "placeholder");
    placeholder.innerHTML = `
        <h2>Chargement...</h2>
        <p>Auteur : Chargement...  - Publié le : Chargement... - Catégorie : Chargement...</p>
        <div class="shimmer"></div>
    `;
    return placeholder;
}
function showPlaceholders() {
    for (let i = 0; i < placeholderCount; i++) articlesContainer.appendChild(createPlaceholder());
}
function removePlaceholders() {
    document.querySelectorAll('.placeholder').forEach(el => el.remove());
}

function safeTruncate(html, maxLen) {
  let truncated = html.slice(0, maxLen);

  truncated = truncated.replace(/&[^\s;]*?$/, '');

  truncated = truncated.replace(/<[^>]*?$/, '');

  const openTags   = [...truncated.matchAll(/<([a-z]+)(\s[^>]*)?>/gi)].map(m => m[1]);
  const closeTags  = [...truncated.matchAll(/<\/([a-z]+)>/gi)].map(m => m[1]);

  const stack = [];
  openTags.forEach(tag => {
    const idxClose = closeTags.indexOf(tag);
    if (idxClose !== -1) {
      closeTags.splice(idxClose, 1);
    } else {
      stack.push(tag);
    }
  });

  stack.reverse().forEach(tag => {
    truncated += `</${tag}>`;
  });

  return truncated;
}

async function loadBatch() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    showPlaceholders();

    const articlesRef = collection(db, "articles");
    let q;
    if (lastVisibleDoc) {
        q = query(
            articlesRef,
            orderBy('realTimestamp', 'desc'),
            startAfter(lastVisibleDoc),
            limit(pageSize)
        );
    } else {
        q = query(
            articlesRef,
            orderBy('realTimestamp', 'desc'),
            limit(pageSize)
        );
    }

    const snapshot = await getDocs(q);
    removePlaceholders();

    if (snapshot.empty) {
        hasMore = false;
        isLoading = false;
        return;
    }

    lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < pageSize) hasMore = false;

    snapshot.forEach(docSnap => {
    const data = docSnap.data();
    let discordContent = toHTML(data.content);
    let htmlContent = discordContent.replaceAll('</small>', '</small><br>');
    const previewHTML = safeTruncate(htmlContent, 300);
    const dateStr = data.timestamp || data.realTimestamp.toDate().toLocaleDateString();

    const articleObj = {
        id: docSnap.id,
        title: data.title,
        author: data.author,
        category: data.category,
        meme: data.meme,
        previewHTML,
        dateStr
    };
    allArticles.push(articleObj);

    if (data.category && !categoriesSet.has(data.category)) {
        categoriesSet.add(data.category);
        const option = document.createElement("option");
        option.value = data.category;
        option.textContent = data.category;
        categoryFilter.appendChild(option);
    }

    const el = document.createElement("div");
    el.classList.add("article-card");
    el.innerHTML = `
        <a href="article.html?id=${docSnap.id}" class="article-link">
            <h2>${data.title}</h2>
            <p>Auteur : ${data.author} - Publié le : ${dateStr} - Catégorie : ${data.category}</p>
            <div>${previewHTML}...</div>
            ${data.meme ? `<img src="${data.meme}" alt="Meme" class="article-image">` : ''}
        </a>
    `;
    articlesContainer.appendChild(el);
    });


    isLoading = false;
}

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) loadBatch(); });
}, { rootMargin: '200px' });
observer.observe(sentinel);

loadBatch();