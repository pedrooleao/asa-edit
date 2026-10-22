package br.pedro.asaedit;

// Tela do Asa Edit no Android. O app sobe o mesmo servidor do Mac (Node.js,
// pelo nodejs-mobile) e mostra a interface numa WebView em tela cheia. Assim
// o tablet fala direto com a WING, e os celulares dos musicos entram nele pelo
// QR code, como entram no Mac.

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.res.AssetManager;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.system.Os;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    static {
        System.loadLibrary("node");
        System.loadLibrary("native-lib");
    }

    private static final String ETIQUETA = "AsaEdit";
    private static final int PORTA = 8730;
    private static final int PEDIDO_ARQUIVO = 7;

    // O Node so pode subir uma vez por processo.
    private static boolean nodeIniciado = false;
    private static String enderecoDaInterface = null;

    public native int iniciarNode(String[] argumentos);

    private WebView web;
    private ValueCallback<Uri[]> aoEscolherArquivo;
    private WifiManager.MulticastLock travaMulticast;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        // Durante o culto a tela nao apaga.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF17191D);
        WebSettings c = web.getSettings();
        c.setJavaScriptEnabled(true);
        c.setDomStorageEnabled(true);
        c.setMediaPlaybackRequiresUserGesture(false);
        // A interface tem o proprio zoom; a fonte do sistema nao desmonta o layout.
        c.setTextZoom(100);
        c.setSupportZoom(false);
        WebView.setWebContentsDebuggingEnabled(true);
        web.addJavascriptInterface(new Ponte(), "AsaAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, int codigo, String descricao, String url) {
                // O servidor caiu ou ainda nao subiu: tenta de novo.
                esperarServidor();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> retorno, FileChooserParams params) {
                if (aoEscolherArquivo != null) aoEscolherArquivo.onReceiveValue(null);
                aoEscolherArquivo = retorno;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Abrir arquivo"), PEDIDO_ARQUIVO);
                } catch (Exception e) {
                    aoEscolherArquivo = null;
                    return false;
                }
                return true;
            }
        });
        setContentView(web);

        if (enderecoDaInterface != null) {
            web.loadUrl(enderecoDaInterface);
        } else {
            web.loadDataWithBaseURL(null,
                "<html><body style='margin:0;height:100vh;display:grid;place-items:center;"
                    + "background:#17191d;color:#9ea3ab;font-family:sans-serif'>Abrindo o Asa Edit…</body></html>",
                "text/html", "utf-8", null);
        }

        // Respostas da procura pela mesa (UDP) chegam mesmo com o Wi-Fi economizando.
        WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
        if (wifi != null) {
            travaMulticast = wifi.createMulticastLock("asa-edit");
            travaMulticast.setReferenceCounted(false);
            travaMulticast.acquire();
        }

        if (!nodeIniciado) {
            nodeIniciado = true;
            new Thread(this::subirNode, "node").start();
        }
        esperarServidor();
    }

    // --- Node ------------------------------------------------------------
    private void subirNode() {
        try {
            File projeto = new File(getFilesDir(), "nodejs-project");
            copiarProjetoSeMudou(projeto);
            File config = new File(getFilesDir(), "config");
            config.mkdirs();
            Os.setenv("ASA_CONFIG", config.getAbsolutePath(), true);
            Os.setenv("ASA_REDE", redesDoAparelho(), true);
            Os.setenv("HOME", getFilesDir().getAbsolutePath(), true);
            Os.setenv("TMPDIR", getCacheDir().getAbsolutePath(), true);
            // Erros do Node num arquivo que da para ler pelo cabo USB (Android/data/...).
            File pastaLog = getExternalFilesDir(null);
            if (pastaLog == null) pastaLog = getFilesDir();
            File log = new File(pastaLog, "node.log");
            mostrarLogAnterior(log);
            Os.setenv("ASA_LOG", log.getAbsolutePath(), true);
            for (String f : new String[] {"app/main/servidor.js", "app/main/esquema.json.gz", "app/main/esquema.json",
                    "app/ui-dist/index.html", "node_modules/ws/package.json"}) {
                Log.i(ETIQUETA, f + (new File(projeto, f).exists() ? " ok" : " FALTANDO"));
            }
            Log.i(ETIQUETA, "Subindo o Node: " + new File(projeto, "app/main/servidor.js"));
            String servidor = new File(projeto, "app/main/servidor.js").getAbsolutePath();
            int saida = iniciarNode(new String[] {"node", servidor});
            Log.e(ETIQUETA, "O Node terminou com o codigo " + saida);
        } catch (Exception e) {
            Log.e(ETIQUETA, "Nao consegui subir o Node", e);
        }
    }

    /** Se o Node caiu da ultima vez, o motivo ficou no node.log: repassa ao logcat. */
    private static void mostrarLogAnterior(File log) {
        try {
            if (!log.exists() || log.length() == 0) return;
            String texto = new String(java.nio.file.Files.readAllBytes(log.toPath()), StandardCharsets.UTF_8);
            if (texto.length() > 8000) texto = texto.substring(texto.length() - 8000);
            for (String linha : texto.split("\n")) Log.w("AsaNode", "(antes) " + linha);
        } catch (Exception e) {
            Log.w(ETIQUETA, "Sem o node.log anterior", e);
        }
    }

    /** Redes IPv4 do aparelho, em JSON, para o servidor (o Node no Android nao ve). */
    private String redesDoAparelho() {
        StringBuilder json = new StringBuilder("[");
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            for (Network rede : cm.getAllNetworks()) {
                LinkProperties lp = cm.getLinkProperties(rede);
                if (lp == null) continue;
                for (LinkAddress la : lp.getLinkAddresses()) {
                    if (!(la.getAddress() instanceof Inet4Address) || la.getAddress().isLoopbackAddress()) continue;
                    if (json.length() > 1) json.append(',');
                    json.append("{\"nome\":\"").append(lp.getInterfaceName())
                        .append("\",\"ip\":\"").append(la.getAddress().getHostAddress())
                        .append("\",\"prefixo\":").append(la.getPrefixLength()).append('}');
                }
            }
        } catch (Exception e) {
            Log.w(ETIQUETA, "Sem a lista de redes", e);
        }
        return json.append(']').toString();
    }

    /** Copia o projeto Node dos assets do APK para o disco, so quando a versao muda. */
    private void copiarProjetoSeMudou(File destino) throws Exception {
        String versao = String.valueOf(getPackageManager().getPackageInfo(getPackageName(), 0).lastUpdateTime);
        File marca = new File(destino, ".versao");
        if (marca.exists()) {
            byte[] lido = java.nio.file.Files.readAllBytes(marca.toPath());
            if (new String(lido, StandardCharsets.UTF_8).equals(versao)) return;
        }
        apagar(destino);
        copiarDosAssets(getAssets(), "nodejs-project", destino);
        try (OutputStream o = new FileOutputStream(marca)) {
            o.write(versao.getBytes(StandardCharsets.UTF_8));
        }
    }

    private static void apagar(File f) {
        File[] filhos = f.listFiles();
        if (filhos != null) for (File x : filhos) apagar(x);
        f.delete();
    }

    private static void copiarDosAssets(AssetManager am, String origem, File destino) throws Exception {
        String[] filhos = am.list(origem);
        if (filhos != null && filhos.length > 0) {
            destino.mkdirs();
            for (String nome : filhos) copiarDosAssets(am, origem + "/" + nome, new File(destino, nome));
            return;
        }
        destino.getParentFile().mkdirs();
        try (InputStream in = am.open(origem); OutputStream out = new FileOutputStream(destino)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
    }

    // --- Interface -------------------------------------------------------
    private boolean esperando = false;

    /** Espera o servidor responder e abre a interface nele. */
    private void esperarServidor() {
        if (esperando) return;
        esperando = true;
        new Thread(() -> {
            for (int tentativa = 0; tentativa < 600; tentativa++) {
                for (int porta = PORTA; porta < PORTA + 10; porta++) {
                    if (responde(porta)) {
                        String url = "http://127.0.0.1:" + porta + "/";
                        enderecoDaInterface = url;
                        runOnUiThread(() -> {
                            esperando = false;
                            web.loadUrl(url);
                        });
                        return;
                    }
                }
                try { Thread.sleep(300); } catch (InterruptedException e) { return; }
            }
            esperando = false;
        }, "espera").start();
    }

    private static boolean responde(int porta) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL("http://127.0.0.1:" + porta + "/").openConnection();
            c.setConnectTimeout(300);
            c.setReadTimeout(1000);
            int codigo = c.getResponseCode();
            if (codigo != 200) return false;
            try (InputStream in = c.getInputStream()) {
                byte[] b = new byte[4096];
                int n = in.read(b);
                return n > 0 && new String(b, 0, n, StandardCharsets.UTF_8).contains("raiz");
            }
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent dados) {
        super.onActivityResult(pedido, resultado, dados);
        if (pedido != PEDIDO_ARQUIVO || aoEscolherArquivo == null) return;
        Uri[] escolhidos = null;
        if (resultado == RESULT_OK && dados != null && dados.getData() != null) escolhidos = new Uri[] {dados.getData()};
        aoEscolherArquivo.onReceiveValue(escolhidos);
        aoEscolherArquivo = null;
    }

    @Override
    public void onBackPressed() {
        // Voltar nao fecha o app no meio do culto: so manda para o fundo.
        moveTaskToBack(true);
    }

    @Override
    protected void onDestroy() {
        if (travaMulticast != null && travaMulticast.isHeld()) travaMulticast.release();
        super.onDestroy();
    }

    /** O que a interface pode pedir ao Android (window.AsaAndroid). */
    private class Ponte {
        /** Salva um arquivo (ex.: .snap) em Downloads. Devolve onde ficou, ou "". */
        @JavascriptInterface
        public String salvarArquivo(String nome, String texto) {
            byte[] dados = texto.getBytes(StandardCharsets.UTF_8);
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, nome);
                    cv.put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) return "";
                    try (OutputStream o = getContentResolver().openOutputStream(uri)) {
                        o.write(dados);
                    }
                    return "Downloads/" + nome;
                }
                File pasta = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File arq = new File(pasta, nome);
                try (OutputStream o = new FileOutputStream(arq)) {
                    o.write(dados);
                }
                return arq.getAbsolutePath();
            } catch (Exception e) {
                Log.e(ETIQUETA, "Nao consegui salvar " + nome, e);
                return "";
            }
        }
    }
}
