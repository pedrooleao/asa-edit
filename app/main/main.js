'use strict';

// Processo principal do Electron: sobe o servidor local e abre a janela.

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { iniciarServidor } = require('./servidor');

// Textos internos do Chromium (e do Electron) em portugues.
app.commandLine.appendSwitch('lang', 'pt-BR');

let janela = null;
let servidor = null;
let pronto = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); }
  });
  iniciar();
}

function arqJanela() {
  return path.join(app.getPath('userData'), 'janela.json');
}

function iniciar() {
  servidor = iniciarServidor({ pastaConfig: app.getPath('userData') });
  servidor.on('pronto', (info) => {
    pronto = info;
    if (app.isReady()) abrirJanela();
  });
  servidor.on('falhou', (err) => {
    app.whenReady().then(() => {
      dialog.showErrorBox('Asa Edit', `Nao consegui iniciar: ${err.message}`);
      app.exit(1);
    });
  });

  app.whenReady().then(() => {
    montarMenu();
    if (pronto) abrirJanela();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && pronto) abrirJanela();
    });
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { if (servidor) servidor.fechar(); });
}

function abrirJanela() {
  if (janela && !janela.isDestroyed()) { janela.focus(); return; }
  let limites = { width: 1440, height: 900 };
  try { limites = { ...limites, ...JSON.parse(fs.readFileSync(arqJanela(), 'utf8')) }; } catch { /* primeira vez */ }

  janela = new BrowserWindow({
    ...limites,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#17191d',
    title: 'Asa Edit',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  janela.loadURL(pronto.url);
  janela.once('ready-to-show', () => janela.show());
  janela.on('close', () => {
    try {
      fs.writeFileSync(arqJanela(), JSON.stringify(janela.getBounds()));
    } catch { /* sem disco */ }
  });
  // O zoom e' da interface (guardado nela); o do Electron fica sempre em 100%.
  janela.webContents.on('did-finish-load', () => janela.webContents.setZoomFactor(1));
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Menus escritos em portugues: os papeis prontos do Electron (undo, minimize...)
// vem com o texto em ingles, entao cada item ganha o seu rotulo.
// O zoom do menu chama o zoom da propria interface (em rem), para os dois
// nao se somarem; o atalho fica so na interface (registerAccelerator: false).
function zoom(delta) {
  if (!janela || janela.isDestroyed()) return;
  janela.webContents.executeJavaScript(`window.asaZoom && window.asaZoom(${delta})`).catch(() => {});
}

function montarMenu() {
  const mac = process.platform === 'darwin';
  const nome = 'Asa Edit';
  const template = [
    ...(mac ? [{
      label: nome,
      submenu: [
        { role: 'about', label: `Sobre o ${nome}` },
        { type: 'separator' },
        { role: 'hide', label: `Ocultar ${nome}` },
        { role: 'hideOthers', label: 'Ocultar outros' },
        { role: 'unhide', label: 'Mostrar tudo' },
        { type: 'separator' },
        { role: 'quit', label: `Sair do ${nome}` },
      ],
    }] : []),
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Tamanho normal', accelerator: 'CmdOrCtrl+0', registerAccelerator: false, click: () => zoom(0) },
        { label: 'Aumentar', accelerator: 'CmdOrCtrl+Plus', registerAccelerator: false, click: () => zoom(0.1) },
        { label: 'Diminuir', accelerator: 'CmdOrCtrl+-', registerAccelerator: false, click: () => zoom(-0.1) },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
        { type: 'separator' },
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
      ],
    },
    {
      label: 'Janela',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Ampliar' },
        ...(mac ? [{ type: 'separator' }, { role: 'front', label: 'Trazer tudo para a frente' }] : [{ role: 'close', label: 'Fechar' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
