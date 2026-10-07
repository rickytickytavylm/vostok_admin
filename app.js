"use strict";

const app = document.querySelector("#app");
const onLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const apiBase = onLocal
  ? (location.port === "4000" ? "" : "http://localhost:4000")
  : "https://api.фабрика-восток.рф";

const TOKEN_KEY = "vostok_admin_token";
let token = onLocal ? "" : localStorage.getItem(TOKEN_KEY) || "";
let categories = [];
let products = [];
let sectionId = "";
let screen = "list";

function toast(message, isError = false) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.toggle("is-err", isError);
  node.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { node.hidden = true; }, 2600);
}

async function api(path, { method = "GET", body, form = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!form && body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${apiBase}/api${path}`, {
    method,
    headers,
    body: form ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !onLocal && path !== "/auth/login") {
    token = "";
    localStorage.removeItem(TOKEN_KEY);
    renderLogin("Пароль не подошёл");
    throw new Error("Нужен пароль");
  }
  if (!res.ok) throw new Error(data.error || "Не получилось сохранить");
  return data;
}

function renderLogin(message) {
  app.innerHTML = "";
  const form = document.createElement("form");
  form.className = "editor";
  const title = document.createElement("h1");
  title.className = "page-title";
  title.textContent = "Вход";
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent = "Пароль тот, что записан на Railway в ADMIN_PASSWORD.";
  const input = document.createElement("input");
  input.type = "password";
  input.autocomplete = "current-password";
  input.required = true;
  const error = document.createElement("p");
  error.className = "lead";
  error.hidden = !message;
  if (message) error.textContent = message;
  form.append(title, lead, field("Пароль", input), error, button("Войти", "primary", () => {}));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await api("/auth/login", { method: "POST", body: { password: input.value } });
      token = data.token;
      localStorage.setItem(TOKEN_KEY, token);
      await load();
      renderList();
    } catch (err) {
      error.hidden = false;
      error.textContent = err.message;
    }
  });
  app.append(form);
}

function section() {
  return categories.find((item) => item.id === sectionId) || categories[0];
}

function inSection() {
  return products
    .filter((item) => item.categoryId === sectionId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function load() {
  categories = await api("/categories");
  products = await api("/products");
  if (!categories.some((item) => item.id === sectionId)) sectionId = categories[0]?.id || "";
}

function button(label, className, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className || "";
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function renderList() {
  screen = "list";
  const current = section();
  app.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "page-title";
  title.textContent = "Наша продукция";
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent = "Разделы те же, что на сайте. Откройте карточку и поменяйте название, описание, цену или фото.";
  app.append(title, lead);

  const switcher = document.createElement("div");
  switcher.className = "switcher";
  categories.forEach((item) => {
    const tab = button(item.label, item.id === sectionId ? "is-on" : "", () => {
      sectionId = item.id;
      renderList();
    });
    switcher.append(tab);
  });
  switcher.append(button("+ раздел", "", () => renderSectionForm()));
  app.append(switcher);

  if (current) {
    const tools = document.createElement("div");
    tools.className = "section-tools";
    tools.append(button("Переименовать этот раздел", "linkish", () => renderSectionForm(current)));
    if (!inSection().length) {
      tools.append(button("Удалить пустой раздел", "linkish", () => askDeleteSection(current)));
    }
    app.append(tools);
  }

  const items = inSection();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = current
      ? `В разделе «${current.label}» пока ничего нет. Нажмите кнопку внизу, чтобы добавить.`
      : "Сначала добавьте раздел.";
    app.append(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "grid";
    items.forEach((product) => grid.append(card(product)));
    app.append(grid);
  }

  if (current) {
    app.append(button(`Добавить в «${current.label}»`, "add", () => renderEditor()));
  }
}

function card(product) {
  const node = document.createElement("article");
  node.className = "card";
  const photo = document.createElement("div");
  photo.className = "card__photo";
  const src = product.images?.whole || product.images?.cut;
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = product.title;
    photo.append(img);
  }
  const body = document.createElement("div");
  body.className = "card__body";
  const name = document.createElement("h2");
  name.className = "card__title";
  name.textContent = product.title;
  const desc = document.createElement("p");
  desc.className = "card__desc";
  desc.textContent = product.description || "";
  const price = document.createElement("p");
  price.className = "card__price";
  const first = product.weights?.[0];
  price.textContent = first ? `${first.price}  ·  ${first.label}` : "Цена не указана";
  body.append(name, desc, price, button("Изменить", "card__edit", () => renderEditor(product)));
  node.append(photo, body);
  return node;
}

function renderEditor(product) {
  screen = "edit";
  const current = section();
  const weights = product?.weights?.length
    ? product.weights.map((item) => ({ ...item }))
    : [{ label: "", price: "" }];
  let whole = product?.images?.whole || "";
  let cut = product?.images?.cut || "";

  app.innerHTML = "";
  app.append(button(`← ${current ? current.label : "К продукции"}`, "back", renderList));

  const form = document.createElement("div");
  form.className = "editor";

  const photos = document.createElement("div");
  photos.className = "photos";
  photos.append(
    photoBox("Фото целиком", whole, (url) => { whole = url; }),
    photoBox("Фото в разрезе", cut, (url) => { cut = url; })
  );

  const title = textInput(product?.title || "", "Например, Домашний");
  const description = document.createElement("textarea");
  description.value = product?.description || "";
  description.placeholder = "Коротко, из чего торт и какой он на вкус";

  form.append(
    photos,
    field("Название", title),
    field("Описание", description),
    field("Фасовка и цена", weightsBox(weights))
  );

  const actions = document.createElement("div");
  actions.className = "editor-actions";
  actions.append(button("Сохранить", "primary", async () => {
    if (!title.value.trim()) return toast("Напишите название", true);
    const payload = {
      title: title.value.trim(),
      categoryId: sectionId,
      description: description.value.trim(),
      weights: weights.filter((item) => item.label || item.price),
      images: { whole, cut },
      published: true,
    };
    if (product) await api(`/products/${product.id}`, { method: "PUT", body: payload });
    else await api("/products", { method: "POST", body: payload });
    toast("Сохранено. На сайте будет так же.");
    await load();
    renderList();
  }));
  if (product) {
    actions.append(button("Удалить карточку", "danger", () => askDeleteProduct(product)));
  }
  form.append(actions);
  app.append(form);
}

function photoBox(label, current, onChange) {
  let url = current;
  const box = document.createElement("div");
  const caption = document.createElement("span");
  caption.textContent = label;
  const frame = document.createElement("div");
  frame.className = "photo";
  const img = document.createElement("img");
  img.alt = label;
  const show = () => {
    img.hidden = !url;
    if (url) img.src = url;
  };
  show();
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.hidden = true;
  const pick = button(url ? "Заменить фото" : "Выбрать фото", "ghost", () => file.click());
  const clear = button("Убрать", "ghost", () => { url = ""; onChange(""); show(); pick.textContent = "Выбрать фото"; });
  const actions = document.createElement("div");
  actions.className = "photo__actions";
  actions.append(pick, clear);
  frame.append(img, actions);
  file.addEventListener("change", async () => {
    const chosen = file.files?.[0];
    file.value = "";
    if (!chosen) return;
    pick.disabled = true;
    pick.textContent = "Загружаю…";
    try {
      const prepared = await prepareImage(chosen);
      const form = new FormData();
      form.append("file", prepared);
      const data = await api("/upload", { method: "POST", form: true, body: form });
      url = data.url;
      onChange(url);
      show();
      toast("Фото загружено");
    } catch (error) {
      toast(error.message, true);
    } finally {
      pick.disabled = false;
      pick.textContent = url ? "Заменить фото" : "Выбрать фото";
    }
  });
  box.append(field(label, frame), file);
  return box;
}

function weightsBox(weights) {
  const wrap = document.createElement("div");
  wrap.className = "weights";
  const draw = () => {
    wrap.innerHTML = "";
    weights.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "weight";
      const label = textInput(item.label, "1 кг");
      const price = textInput(item.price, "900 ₽");
      label.addEventListener("input", () => { item.label = label.value; });
      price.addEventListener("input", () => { item.price = price.value; });
      row.append(label, price, button("Убрать", "ghost", () => {
        weights.splice(index, 1);
        if (!weights.length) weights.push({ label: "", price: "" });
        draw();
      }));
      wrap.append(row);
    });
    wrap.append(button("Добавить ещё вес", "ghost", () => {
      weights.push({ label: "", price: "" });
      draw();
    }));
  };
  draw();
  return wrap;
}

function renderSectionForm(category) {
  app.innerHTML = "";
  app.append(button("← Назад к продукции", "back", renderList));
  const form = document.createElement("div");
  form.className = "editor";
  const input = textInput(category?.label || "", "Например, Воздушно-ореховые");
  form.append(field(category ? "Новое название раздела" : "Название нового раздела", input));
  form.append(button("Сохранить раздел", "primary", async () => {
    const label = input.value.trim();
    if (!label) return toast("Напишите название", true);
    if (category) {
      await api(`/categories/${category.id}`, { method: "PUT", body: { label } });
    } else {
      const created = await api("/categories", {
        method: "POST",
        body: { label, order: categories.length + 1 },
      });
      sectionId = created.id;
    }
    toast("Раздел сохранён");
    await load();
    renderList();
  }));
  app.append(form);
}

function askDeleteProduct(product) {
  const box = document.createElement("div");
  box.className = "ask";
  const text = document.createElement("p");
  text.textContent = `Удалить «${product.title}» с сайта?`;
  const row = document.createElement("div");
  row.className = "editor-actions";
  row.append(
    button("Да, удалить", "danger", async () => {
      await api(`/products/${product.id}`, { method: "DELETE" });
      toast("Карточка удалена");
      await load();
      renderList();
    }),
    button("Нет, оставить", "ghost", () => box.remove())
  );
  box.append(text, row);
  app.append(box);
}

function askDeleteSection(category) {
  const box = document.createElement("div");
  box.className = "ask";
  const text = document.createElement("p");
  text.textContent = `Удалить раздел «${category.label}»? Карточек в нём нет.`;
  const row = document.createElement("div");
  row.className = "editor-actions";
  row.append(
    button("Удалить раздел", "danger", async () => {
      await api(`/categories/${category.id}`, { method: "DELETE" });
      sectionId = "";
      toast("Раздел удалён");
      await load();
      renderList();
    }),
    button("Оставить", "ghost", () => box.remove())
  );
  box.append(text, row);
  app.append(box);
}

function field(label, control) {
  const wrap = document.createElement("label");
  wrap.className = "field";
  const span = document.createElement("span");
  span.textContent = label;
  wrap.append(span, control);
  return wrap;
}

function textInput(value, placeholder) {
  const node = document.createElement("input");
  node.value = value;
  node.placeholder = placeholder;
  return node;
}

async function prepareImage(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Это фото не открывается. Сохраните его как JPG.");
  const max = 1800;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  bitmap.close?.();
  if (!blob) throw new Error("Не удалось подготовить фото");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

if (!onLocal && !token) renderLogin();
else load().then(renderList).catch((error) => toast(error.message, true));
