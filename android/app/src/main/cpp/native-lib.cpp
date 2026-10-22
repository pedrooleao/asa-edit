// Sobe o Node.js (nodejs-mobile) dentro do app. O Node quer o argv numa area
// de memoria continua, e a saida dele (console.log) vai para o logcat, com a
// etiqueta "AsaNode", para dar para ver o que acontece no tablet.

#include <jni.h>
#include <android/log.h>
#include <pthread.h>
#include <unistd.h>
#include <fcntl.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include "node.h"

static const char *ETIQUETA = "AsaNode";
static int canoSaida[2];
static int canoErro[2];

static void *repassar(void *arg) {
    int *cano = static_cast<int *>(arg);
    int prioridade = cano == canoErro ? ANDROID_LOG_ERROR : ANDROID_LOG_INFO;
    char buf[2048];
    ssize_t n;
    while ((n = read(cano[0], buf, sizeof buf - 1)) > 0) {
        if (buf[n - 1] == '\n') --n;
        buf[n] = 0;
        __android_log_write(prioridade, ETIQUETA, buf);
    }
    return nullptr;
}

// stdout vai para o logcat. stderr (onde o Node escreve os erros) vai tambem
// para um arquivo (ASA_LOG), escrito na hora: se o Node derrubar o app, o
// motivo fica la, mesmo que o logcat nao tenha tido tempo de receber.
static void redirecionarSaida() {
    setvbuf(stdout, nullptr, _IOLBF, 0);
    setvbuf(stderr, nullptr, _IONBF, 0);
    pipe(canoSaida);
    dup2(canoSaida[1], STDOUT_FILENO);
    pthread_t t1;
    if (pthread_create(&t1, nullptr, repassar, canoSaida) == 0) pthread_detach(t1);
    const char *arquivo = getenv("ASA_LOG");
    int fd = arquivo ? open(arquivo, O_WRONLY | O_CREAT | O_TRUNC, 0644) : -1;
    if (fd >= 0) {
        dup2(fd, STDERR_FILENO);
        close(fd);
    } else {
        pipe(canoErro);
        dup2(canoErro[1], STDERR_FILENO);
        pthread_t t2;
        if (pthread_create(&t2, nullptr, repassar, canoErro) == 0) pthread_detach(t2);
    }
}

extern "C" JNIEXPORT jint JNICALL
Java_br_pedro_asaedit_MainActivity_iniciarNode(JNIEnv *env, jobject, jobjectArray argumentos) {
    jsize argc = env->GetArrayLength(argumentos);
    std::vector<std::string> partes;
    size_t total = 0;
    for (jsize i = 0; i < argc; i++) {
        auto s = (jstring) env->GetObjectArrayElement(argumentos, i);
        const char *c = env->GetStringUTFChars(s, nullptr);
        partes.emplace_back(c);
        total += strlen(c) + 1;
        env->ReleaseStringUTFChars(s, c);
    }
    char *area = static_cast<char *>(calloc(total, 1));
    std::vector<char *> argv(argc);
    char *p = area;
    for (jsize i = 0; i < argc; i++) {
        memcpy(p, partes[i].c_str(), partes[i].size());
        argv[i] = p;
        p += partes[i].size() + 1;
    }
    redirecionarSaida();
    return jint(node::Start(argc, argv.data()));
}
