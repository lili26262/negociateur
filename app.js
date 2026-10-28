"use strict";
const { useState, useEffect, useRef, useCallback } = React;
/* Le Négociateur : prototype.
   Photo ou PDF d'une facture, frais en trop repérés, message prêt à envoyer. */
/* Palette : l'encre, le surligneur, le stylo rouge */
const INK = "#12163A";
const PAPER = "#ECEFF8";
const HILITE = "#FFE14A";
const RED = "#C92A1E";
const MUTED = "#555B7E";
const RULE = "#CBD1E6";
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif';
const CSS = `
.nz { font-family: ${SANS}; color: ${INK}; background: ${PAPER}; min-height: 100vh; overflow-x: hidden; -webkit-text-size-adjust: 100%; }
.nz *, .nz *::before, .nz *::after { box-sizing: border-box; }
.nz button, .nz textarea { font-family: inherit; }
.nz h1, .nz h2, .nz h3, .nz p, .nz ul, .nz ol { margin: 0; padding: 0; }
.nz ul, .nz ol { list-style: none; }
.nz-sheet { background: #fff; position: relative; }
.nz-zig { margin-bottom: 12px; }
.nz-zig::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 8px;
  background: linear-gradient(135deg, #fff 4px, transparent 0) 0 0 / 8px 8px repeat-x,
              linear-gradient(225deg, #fff 4px, transparent 0) 0 0 / 8px 8px repeat-x; }
.nz-hl { background: ${HILITE}; padding: 1px 5px; margin: 0 -5px; border-radius: 3px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.nz-strike { text-decoration: line-through; text-decoration-color: ${RED}; text-decoration-thickness: 2px; }
.nz-hlnum { position: relative; display: inline-block; isolation: isolate; padding: 0 .1em; white-space: nowrap; }
.nz-hlnum::before { content: ""; position: absolute; z-index: -1; left: -.04em; right: -.04em; top: .1em; bottom: .02em; background: ${HILITE}; transform: rotate(-1.2deg); border-radius: .1em .18em .08em .16em; }
.nz-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 56px; padding: 0 20px; border-radius: 14px; border: 2px solid ${INK}; font-size: 17px; font-weight: 700; cursor: pointer; transition: transform .12s ease; }
.nz-btn:active { transform: scale(.985); }
.nz-primary { background: ${INK}; color: #fff; }
.nz-ghost { background: transparent; color: ${INK}; }
.nz-done { background: ${HILITE}; color: ${INK}; }
.nz-link { background: none; border: 0; padding: 12px 6px; color: ${INK}; font-size: 16px; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; cursor: pointer; }
.nz-btn:focus-visible, .nz-link:focus-visible, .nz textarea:focus-visible { outline: 3px solid ${INK}; outline-offset: 3px; }
.nz-sweep { position: absolute; left: 0; right: 0; top: 4%; height: 15%; background: ${HILITE}; mix-blend-mode: multiply; opacity: .9; animation: nz-sweep 1.9s ease-in-out infinite alternate; }
@keyframes nz-sweep { from { top: 4%; } to { top: 81%; } }
.nz-pulse { animation: nz-pulse 1.4s ease-in-out infinite; }
@keyframes nz-pulse { 0%, 100% { opacity: .4; } 50% { opacity: .9; } }
@media (prefers-reduced-motion: reduce) {
  .nz-sweep { animation: none; top: 42%; }
  .nz-pulse { animation: none; }
  .nz-btn { transition: none; }
}
`;
/* ---------- Données ---------- */
const CATS = {
    internet: "Internet",
    mobile: "Téléphone mobile",
    electricite: "Électricité",
    gaz: "Gaz",
    eau: "Eau",
    assurance: "Assurance",
    abonnement: "Abonnement",
    banque: "Banque",
    autre: "Facture",
};
const ETAPES = [
    "Lecture de la facture",
    "Recherche des frais en trop",
    "Vérification des hausses de prix",
    "Calcul de ce que tu peux récupérer",
];
const ETAPES_SUIVANTES = [
    "Envoie le message par e-mail ou depuis ton espace client.",
    "Garde la réponse écrite : c'est ta preuve.",
    "Si on te dit non, demande le service réclamations.",
];
const LIGNES_EXEMPLE = [
    ["Forfait fibre 1 Gb/s", "39,99", false],
    ["Location box", "5,00", true],
    ["Frais de service", "3,00", true],
    ["Assurance box", "2,99", true],
    ["Option TV Plus", "9,90", false],
];
const TEXTE_EXEMPLE = `NovaNet, Fibre Maison
Contrat n° 48213377
Période : 1er au 30 septembre

Forfait fibre 1 Gb/s ........ 39,99 €
Location box ................ 5,00 €
Frais de service ............ 3,00 €
Assurance box ............... 2,99 €
Option TV Plus .............. 9,90 €
Total TTC ................... 60,88 €

Offre souscrite : 29,99 € par mois pendant 12 mois, puis 39,99 € par mois.
Date de souscription : 1er septembre de l'an dernier.`;
const ERREURS = {
    illisible: {
        titre: "Facture illisible",
        texte: "On n'arrive pas à lire une facture ici. Prends la photo bien à plat, avec de la lumière et sans reflet, ou envoie le PDF.",
    },
    echec: {
        titre: "L'analyse n'a pas abouti",
        texte: "Réessaie dans un instant. Si ça recommence, essaie avec une photo plus nette.",
    },
    format: {
        titre: "Format non pris en charge",
        texte: "Envoie une photo (JPG ou PNG) ou un PDF.",
    },
    gros: {
        titre: "Fichier trop lourd",
        texte: "Choisis un PDF de moins de 8 Mo, ou prends une photo.",
    },
};
/* ---------- Consignes données à l'IA ---------- */
const SYSTEM_ANALYSE = `Tu es un expert en facturation grand public (téléphone, internet, énergie, eau, assurance, abonnements, banque). On te donne une facture (photo, PDF ou texte). Ta mission : repérer ce que le client paie en trop et pourrait faire corriger, rembourser ou renégocier.

Règles :
- Appuie-toi d'abord sur ce qui est visible sur la facture : frais de service ou de dossier, options ou assurances que le client n'a peut-être pas demandées, doublons, hausses de prix, fin de promotion, pénalités, lignes inhabituelles.
- Tu peux comparer le tarif aux prix habituels du marché du pays concerné. C'est une estimation : mets alors certitude "a_verifier".
- N'invente rien. Si rien ne semble anormal, renvoie "anomalies": []. C'est une bonne réponse.
- Si le document est illisible ou n'est pas une facture, mets "lisible": false.
- "economie_annuelle" : estimation sur 12 mois, dans la devise de la facture. Tiens compte du rythme de facturation (mensuel, bimestriel, trimestriel...).
- "categorie" : internet, mobile, electricite, gaz, eau, assurance, abonnement, banque ou autre.
- "langue" : la langue de la facture, écrite en français (français, hébreu, anglais...).
- "devise" : le symbole (€, ₪, $...).
- "titre" : 6 mots maximum. "detail" : 1 à 2 phrases courtes en français. "ligne" : le libellé de la ligne concernée tel qu'écrit sur la facture, ou "". "verdict" : 1 phrase en français.
- Maximum 5 anomalies, les plus coûteuses d'abord.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni balises markdown, au format :
{"lisible":true,"fournisseur":"","categorie":"","periode":"","montant_total":0,"devise":"","langue":"","anomalies":[{"titre":"","detail":"","ligne":"","economie_annuelle":0,"certitude":"sure"}],"verdict":""}
"certitude" vaut "sure", "probable" ou "a_verifier".`;
const SYSTEM_LETTRE = `Tu rédiges des messages de réclamation pour des clients de services grand public. Ton : poli, précis, ferme. Jamais de menace ni d'exagération.

On te donne en JSON l'analyse d'une facture. Écris le message à envoyer au service client du fournisseur, dans la langue de la facture (champ "langue").

Structure :
- une ligne d'objet (avec le mot "Objet" traduit dans la langue du message)
- salutation
- contexte : la facture et sa période
- les points contestés, un par ligne, avec le libellé de la ligne facturée quand il existe
- la demande précise : correction ou remboursement des lignes contestées, ou révision du tarif quand il s'agit d'une hausse
- une demande de réponse écrite sous 15 jours
- formule de politesse

Laisse [Prénom Nom] et [Numéro client] entre crochets pour que le client les remplisse. 150 mots maximum. Réponds uniquement avec le message, sans commentaire.`;
const SYSTEM_TRADUCTION = "Traduis ce message en français, fidèlement, en gardant sa mise en forme. Réponds uniquement avec la traduction.";
/* ---------- Outils ---------- */
const fmt = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
const fmt2 = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
function num(x) {
    if (typeof x === "number")
        return isFinite(x) ? x : 0;
    const n = parseFloat(String(x).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : 0;
}
function parseJson(text) {
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1)
        throw new Error("json");
    return JSON.parse(clean.slice(start, end + 1));
}
function normalise(raw) {
    const liste = (Array.isArray(raw.anomalies) ? raw.anomalies : [])
        .filter((a) => a && typeof a === "object")
        .slice(0, 5)
        .map((a, i) => ({
        id: i,
        titre: String(a.titre || "Point à vérifier"),
        detail: String(a.detail || ""),
        ligne: String(a.ligne || ""),
        economie: Math.max(0, Math.round(num(a.economie_annuelle))),
        certitude: ["sure", "probable", "a_verifier"].includes(a.certitude) ? a.certitude : "a_verifier",
    }))
        .sort((a, b) => b.economie - a.economie);
    return {
        lisible: raw.lisible !== false,
        fournisseur: String(raw.fournisseur || "Fournisseur inconnu"),
        categorie: String(raw.categorie || ""),
        periode: String(raw.periode || ""),
        total: num(raw.montant_total),
        devise: String(raw.devise || "€"),
        langue: String(raw.langue || "français"),
        verdict: String(raw.verdict || ""),
        anomalies: liste,
        economieAnnuelle: liste.reduce((s, a) => s + a.economie, 0),
    };
}
async function askClaude(system, content) {
    const response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_tokens: 4000, system, messages: [{ role: "user", content }] }),
    });
    if (!response.ok)
        throw new Error("api");
    const data = await response.json();
    if (data.error)
        throw new Error("api");
    return (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
}
function lireDataUrl(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("lecture"));
        r.readAsDataURL(file);
    });
}
function lireImage(file) {
    return lireDataUrl(file).then((src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 1600;
            const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(1, Math.round(img.naturalWidth * scale));
            const h = Math.max(1, Math.round(img.naturalHeight * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            resolve({ data: dataUrl.split(",")[1], preview: dataUrl });
        };
        img.onerror = () => reject(new Error("image"));
        img.src = src;
    }));
}
function useCountUp(target) {
    const [v, setV] = useState(0);
    useEffect(() => {
        const reduce = typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || target <= 0) {
            setV(target);
            return undefined;
        }
        let raf = 0;
        const t0 = performance.now();
        const tick = (t) => {
            const p = Math.min(1, (t - t0) / 1400);
            setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
            if (p < 1)
                raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target]);
    return v;
}
/* ---------- Petits éléments ---------- */
function Wordmark() {
    return React.createElement("div", { style: { fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em" } }, "Le N\u00E9gociateur");
}
function IconCamera() {
    return (React.createElement("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
        React.createElement("path", { d: "M4 8h3l2-3h6l2 3h3v11H4z" }),
        React.createElement("circle", { cx: "12", cy: "13", r: "3.5" })));
}
function IconBack() {
    return (React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
        React.createElement("path", { d: "M15 5l-7 7 7 7" })));
}
function Certitude({ level }) {
    const label = { sure: "Sûr", probable: "Probable", a_verifier: "À vérifier" }[level];
    return (React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 } },
        React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 12 12", "aria-hidden": "true" },
            React.createElement("circle", { cx: "6", cy: "6", r: "5", fill: level === "sure" ? INK : "none", stroke: INK, strokeWidth: "1.5" }),
            level === "probable" && React.createElement("path", { d: "M6 1 A5 5 0 0 1 6 11 Z", fill: INK })),
        label));
}
/* ---------- Écrans ---------- */
function Accueil({ onScan, onExemple, history }) {
    const totaux = {};
    history.forEach((h) => {
        totaux[h.devise] = (totaux[h.devise] || 0) + h.economie;
    });
    const totalTexte = Object.keys(totaux)
        .map((d) => `${fmt(totaux[d])} ${d}`)
        .join(" + ");
    return (React.createElement("div", { className: "px-5 pb-14 pt-6" },
        React.createElement(Wordmark, null),
        React.createElement("div", { className: "nz-sheet nz-zig", "aria-hidden": "true", style: { marginTop: 28, padding: "20px 18px 22px", transform: "rotate(-1.2deg)" } },
            React.createElement("div", { style: { fontWeight: 700, fontSize: 15 } }, "NovaNet, Fibre Maison"),
            React.createElement("div", { style: { color: MUTED, fontSize: 13, marginBottom: 12 } }, "Facture de septembre"),
            LIGNES_EXEMPLE.map(([nom, prix, marque]) => (React.createElement("div", { key: nom, className: "flex items-baseline justify-between", style: { fontSize: 15, padding: "5px 0" } },
                React.createElement("span", { className: marque ? "nz-hl" : "" }, nom),
                React.createElement("span", { className: marque ? "nz-strike" : "", style: { fontVariantNumeric: "tabular-nums" } },
                    prix,
                    " \u20AC")))),
            React.createElement("div", { className: "flex justify-between", style: { marginTop: 8, paddingTop: 10, borderTop: `2px dashed ${RULE}`, fontWeight: 700, fontSize: 15 } },
                React.createElement("span", null, "Total"),
                React.createElement("span", { style: { fontVariantNumeric: "tabular-nums" } }, "60,88 \u20AC")),
            React.createElement("div", { style: {
                    marginTop: 14,
                    color: RED,
                    fontWeight: 800,
                    fontSize: 16,
                    transform: "rotate(-2.5deg)",
                    transformOrigin: "left center",
                } }, "3 lignes \u00E0 contester")),
        React.createElement("h1", { style: { marginTop: 40, fontSize: 36, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.035em" } }, "Tu paies peut-\u00EAtre trop. Une photo suffit pour le savoir."),
        React.createElement("p", { style: { marginTop: 16, fontSize: 17, lineHeight: 1.5, color: MUTED } }, "Photographie ta facture. On rep\u00E8re les frais en trop et on \u00E9crit la r\u00E9clamation \u00E0 ta place."),
        React.createElement("div", { style: { marginTop: 28 } },
            React.createElement("button", { className: "nz-btn nz-primary", onClick: onScan },
                React.createElement(IconCamera, null),
                "Scanner une facture"),
            React.createElement("div", { style: { textAlign: "center", marginTop: 6 } },
                React.createElement("button", { className: "nz-link", onClick: onExemple }, "Essayer avec une facture exemple")),
            React.createElement("p", { style: { marginTop: 10, fontSize: 13, lineHeight: 1.5, color: MUTED, textAlign: "center" } },
                "Photo ou PDF. L'image n'est pas enregistr\u00E9e dans l'appli.",
                React.createElement("br", null),
                "Prototype : les montants sont des estimations de l'IA.")),
        history.length > 0 && (React.createElement("section", { style: { marginTop: 44 } },
            React.createElement("h2", { style: { fontSize: 16, fontWeight: 700, color: MUTED } }, "D\u00E9j\u00E0 rep\u00E9r\u00E9"),
            React.createElement("div", { style: { marginTop: 8, fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05 } }, totalTexte),
            React.createElement("p", { style: { fontSize: 15, color: MUTED, marginTop: 2 } },
                "par an, sur ",
                history.length,
                " facture",
                history.length > 1 ? "s" : ""),
            React.createElement("ul", { style: { marginTop: 14 } }, history.map((h) => (React.createElement("li", { key: h.id, className: "flex items-baseline justify-between gap-3", style: { padding: "10px 0", borderTop: `2px dashed ${RULE}`, fontSize: 16 } },
                React.createElement("span", { dir: "auto", style: { fontWeight: 600 } }, h.fournisseur),
                React.createElement("span", { style: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } },
                    fmt(h.economie),
                    " ",
                    h.devise)))))))));
}
function Analyse({ source, onCancel }) {
    const [i, setI] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setI((x) => Math.min(x + 1, ETAPES.length - 1)), 2600);
        return () => clearInterval(t);
    }, []);
    const kind = source ? source.kind : "";
    return (React.createElement("div", { className: "px-5 pb-14 pt-6" },
        React.createElement(Wordmark, null),
        React.createElement("div", { className: "nz-sheet", style: { marginTop: 28, height: 380, overflow: "hidden" } },
            kind === "image" && source.preview ? (React.createElement("img", { src: source.preview, alt: "Ta facture en cours d'analyse", style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" } })) : (React.createElement("div", { style: { padding: "20px 18px" } }, kind === "exemple" ? (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { fontWeight: 700, fontSize: 15 } }, "NovaNet, Fibre Maison"),
                React.createElement("div", { style: { color: MUTED, fontSize: 13, marginBottom: 12 } }, "Facture de septembre"),
                LIGNES_EXEMPLE.map(([nom, prix]) => (React.createElement("div", { key: nom, className: "flex items-baseline justify-between", style: { fontSize: 15, padding: "7px 0" } },
                    React.createElement("span", null, nom),
                    React.createElement("span", { style: { fontVariantNumeric: "tabular-nums" } },
                        prix,
                        " \u20AC")))))) : (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { fontWeight: 700, fontSize: 15, marginBottom: 16, wordBreak: "break-all" } }, source && source.name),
                [90, 100, 70, 95, 60, 100, 80, 90, 50].map((w, k) => (React.createElement("div", { key: k, style: { height: 10, width: w + "%", background: RULE, borderRadius: 5, marginBottom: 16 } }))))))),
            React.createElement("div", { className: "nz-sweep" })),
        React.createElement("p", { role: "status", style: { marginTop: 24, fontSize: 18, fontWeight: 700 } }, ETAPES[i]),
        React.createElement("p", { style: { marginTop: 4, color: MUTED, fontSize: 15 } }, "\u00C7a prend quelques secondes."),
        React.createElement("button", { className: "nz-link", onClick: onCancel, style: { marginTop: 12, paddingLeft: 0 } }, "Annuler")));
}
function Erreur({ errorKey, onScan, onHome }) {
    const e = ERREURS[errorKey] || ERREURS.echec;
    return (React.createElement("div", { className: "px-5 pb-14 pt-6" },
        React.createElement(Wordmark, null),
        React.createElement("h1", { style: { marginTop: 48, fontSize: 30, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.03em", color: RED } }, e.titre),
        React.createElement("p", { style: { marginTop: 12, fontSize: 17, lineHeight: 1.5, color: MUTED } }, e.texte),
        React.createElement("div", { style: { marginTop: 28 } },
            React.createElement("button", { className: "nz-btn nz-primary", onClick: onScan },
                React.createElement(IconCamera, null),
                "Scanner une facture"),
            React.createElement("div", { style: { textAlign: "center", marginTop: 6 } },
                React.createElement("button", { className: "nz-link", onClick: onHome }, "Retour")))));
}
function Resultat({ r, letter, onLetter, onRetryLetter, trad, onTranslate, copy, onCopy, onBack, onScan }) {
    const v = useCountUp(r.economieAnnuelle);
    const digits = String(r.economieAnnuelle).length;
    const size = digits <= 3 ? 88 : digits <= 4 ? 76 : digits <= 5 ? 62 : 50;
    const meta = (CATS[r.categorie] || "Facture") + (r.periode ? ", " + r.periode : "");
    const aTraduire = !/fran[cç]ais|french/i.test(r.langue);
    const has = r.anomalies.length > 0;
    const rows = Math.min(30, Math.max(10, Math.ceil(letter.text.length / 34) + letter.text.split("\n").length));
    return (React.createElement("div", { className: "px-5 pb-14 pt-5" },
        React.createElement("button", { className: "nz-link", onClick: onBack, style: { display: "inline-flex", alignItems: "center", gap: 4, paddingLeft: 0 } },
            React.createElement(IconBack, null),
            "Retour"),
        React.createElement("div", { className: "nz-sheet nz-zig", style: { marginTop: 10 } },
            React.createElement("section", { style: { padding: "26px 20px 24px" } },
                React.createElement("div", { dir: "auto", style: { fontWeight: 800, fontSize: 18 } }, r.fournisseur),
                React.createElement("div", { style: { color: MUTED, fontSize: 14, marginTop: 2 } }, meta),
                r.total > 0 && (React.createElement("div", { style: { color: MUTED, fontSize: 14 } },
                    "Montant de la facture : ",
                    fmt2(r.total),
                    " ",
                    r.devise)),
                has && r.economieAnnuelle > 0 ? (React.createElement("div", { style: { marginTop: 28 } },
                    React.createElement("div", { style: { fontSize: 17, fontWeight: 600 } }, "Tu paies peut-\u00EAtre de trop"),
                    React.createElement("div", { style: { marginTop: 14, lineHeight: 1 } },
                        React.createElement("span", { className: "nz-hlnum", style: { fontSize: size, fontWeight: 900, letterSpacing: "-0.045em", fontVariantNumeric: "tabular-nums" } },
                            fmt(v),
                            React.createElement("span", { style: { fontSize: size * 0.5, letterSpacing: 0, marginLeft: 8 } }, r.devise))),
                    React.createElement("div", { style: { marginTop: 12, fontSize: 17, fontWeight: 600 } }, "par an"))) : (React.createElement("div", { style: { marginTop: 28, fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 } }, has ? "Des points à vérifier." : "Rien d'anormal sur cette facture.")),
                r.verdict && React.createElement("p", { style: { marginTop: 16, fontSize: 16, lineHeight: 1.5 } }, r.verdict),
                has && (React.createElement("p", { style: { marginTop: 10, fontSize: 13, lineHeight: 1.5, color: MUTED } }, "Estimation faite par l'IA. V\u00E9rifie chaque point avant d'envoyer le message."))),
            has && (React.createElement("section", { style: { padding: "22px 20px", borderTop: `2px dashed ${RULE}` } },
                React.createElement("h2", { style: { fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" } }, "Ce qu'on a rep\u00E9r\u00E9"),
                React.createElement("ul", { style: { marginTop: 6 } }, r.anomalies.map((a, idx) => (React.createElement("li", { key: a.id, style: { padding: "16px 0", borderTop: idx === 0 ? "none" : `2px dashed ${RULE}` } },
                    React.createElement("div", { className: "flex justify-between gap-4" },
                        React.createElement("div", { style: { minWidth: 0 } },
                            React.createElement("h3", { style: { fontSize: 17, fontWeight: 700, lineHeight: 1.25 } }, a.titre),
                            a.ligne && (React.createElement("div", { style: { marginTop: 8, fontSize: 14, lineHeight: 1.7 } },
                                React.createElement("span", { dir: "auto", className: "nz-hl" }, a.ligne))),
                            a.detail && (React.createElement("p", { style: { marginTop: 8, fontSize: 15, lineHeight: 1.5, color: MUTED } }, a.detail))),
                        React.createElement("div", { className: "shrink-0", style: { textAlign: "right" } },
                            React.createElement("div", { style: { fontSize: 19, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } }, a.economie > 0 ? `${fmt(a.economie)} ${r.devise}` : "à voir"),
                            a.economie > 0 && React.createElement("div", { style: { fontSize: 13, color: MUTED } }, "par an"))),
                    React.createElement("div", { style: { marginTop: 10, fontSize: 13, color: MUTED } },
                        React.createElement(Certitude, { level: a.certitude })))))))),
            has && (React.createElement("section", { style: { padding: "22px 20px", borderTop: `2px dashed ${RULE}` } },
                React.createElement("h2", { style: { fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" } }, "Ton message"),
                letter.status === "loading" && (React.createElement("div", { role: "status", style: { marginTop: 14 } },
                    React.createElement("p", { style: { color: MUTED, fontSize: 15 } }, "R\u00E9daction du message\u2026"),
                    React.createElement("div", { className: "nz-pulse", style: { marginTop: 14 } }, [92, 100, 84, 96, 60].map((w, k) => (React.createElement("div", { key: k, style: { height: 10, width: w + "%", background: RULE, borderRadius: 5, marginBottom: 12 } })))))),
                letter.status === "erreur" && (React.createElement("div", { style: { marginTop: 14 } },
                    React.createElement("p", { style: { color: RED, fontSize: 15 } }, "Le message n'a pas pu \u00EAtre \u00E9crit."),
                    React.createElement("button", { className: "nz-link", onClick: onRetryLetter, style: { paddingLeft: 0 } }, "R\u00E9\u00E9crire le message"))),
                letter.status === "ok" && (React.createElement("div", { style: { marginTop: 10 } },
                    React.createElement("p", { style: { color: MUTED, fontSize: 14, lineHeight: 1.45 } }, "Remplis les crochets, relis, puis copie."),
                    React.createElement("textarea", { dir: "auto", "aria-label": "Message de r\u00E9clamation", value: letter.text, onChange: (e) => onLetter(e.target.value), rows: rows, style: {
                            marginTop: 12,
                            width: "100%",
                            padding: 14,
                            border: `2px solid ${RULE}`,
                            borderRadius: 10,
                            fontFamily: SERIF,
                            fontSize: 16,
                            lineHeight: 1.6,
                            color: INK,
                            background: "#fff",
                            resize: "vertical",
                        } }),
                    React.createElement("div", { style: { marginTop: 14 } },
                        React.createElement("button", { className: `nz-btn ${copy === "ok" ? "nz-done" : "nz-primary"}`, onClick: onCopy }, copy === "ok"
                            ? "Message copié"
                            : copy === "ko"
                                ? "Sélectionne le texte pour le copier"
                                : "Copier le message")),
                    aTraduire && (React.createElement("div", { style: { marginTop: 10 } },
                        React.createElement("button", { className: "nz-btn nz-ghost", onClick: onTranslate, disabled: trad.status === "loading" }, trad.status === "loading" ? "Traduction en cours…" : "Comprendre en français"),
                        trad.status === "ok" && (React.createElement("div", { style: { marginTop: 14, padding: 14, background: PAPER, borderRadius: 10 } },
                            React.createElement("p", { style: { fontSize: 13, color: MUTED, fontWeight: 600 } }, "Traduction pour toi, \u00E0 ne pas envoyer"),
                            React.createElement("p", { style: { marginTop: 8, fontFamily: SERIF, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, trad.text))),
                        trad.status === "erreur" && (React.createElement("p", { style: { marginTop: 10, color: RED, fontSize: 14 } }, "La traduction a \u00E9chou\u00E9. R\u00E9essaie.")))))))),
            has && (React.createElement("section", { style: { padding: "22px 20px 28px", borderTop: `2px dashed ${RULE}` } },
                React.createElement("h2", { style: { fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" } }, "Ensuite"),
                React.createElement("ol", { style: { marginTop: 10 } }, ETAPES_SUIVANTES.map((s, k) => (React.createElement("li", { key: k, className: "flex gap-3", style: { padding: "6px 0", fontSize: 16, lineHeight: 1.5 } },
                    React.createElement("span", { style: { fontWeight: 800, minWidth: 18 } },
                        k + 1,
                        "."),
                    React.createElement("span", null, s)))))))),
        React.createElement("button", { className: "nz-btn nz-primary", onClick: onScan, style: { marginTop: 28 } },
            React.createElement(IconCamera, null),
            "Scanner une autre facture")));
}
/* ---------- Application ---------- */
function LeNegociateur() {
    const [screen, setScreen] = useState("home");
    const [source, setSource] = useState(null);
    const [result, setResult] = useState(null);
    const [errorKey, setErrorKey] = useState("echec");
    const [letter, setLetter] = useState({ status: "idle", text: "" });
    const [trad, setTrad] = useState({ status: "idle", text: "" });
    const [history, setHistory] = useState([]);
    const [copy, setCopy] = useState("idle");
    const fileRef = useRef(null);
    const runRef = useRef(0);
    useEffect(() => {
        try {
            window.scrollTo(0, 0);
        }
        catch (e) {
            /* rien */
        }
    }, [screen]);
    const writeLetter = useCallback(async (r, run) => {
        setLetter({ status: "loading", text: "" });
        setTrad({ status: "idle", text: "" });
        try {
            const payload = JSON.stringify({
                fournisseur: r.fournisseur,
                categorie: r.categorie,
                periode: r.periode,
                montant_total: r.total,
                devise: r.devise,
                langue: r.langue,
                anomalies: r.anomalies.map((a) => ({
                    titre: a.titre,
                    detail: a.detail,
                    ligne: a.ligne,
                    economie_annuelle: a.economie,
                })),
            });
            const text = await askClaude(SYSTEM_LETTRE, payload);
            if (run !== runRef.current)
                return;
            setLetter({ status: "ok", text });
        }
        catch (e) {
            if (run !== runRef.current)
                return;
            setLetter({ status: "erreur", text: "" });
        }
    }, []);
    const analyse = useCallback(async (src, content) => {
        const run = ++runRef.current;
        setSource(src);
        setResult(null);
        setLetter({ status: "idle", text: "" });
        setTrad({ status: "idle", text: "" });
        setCopy("idle");
        setScreen("analyse");
        try {
            const raw = await askClaude(SYSTEM_ANALYSE, content);
            if (run !== runRef.current)
                return;
            const r = normalise(parseJson(raw));
            if (!r.lisible) {
                setErrorKey("illisible");
                setScreen("erreur");
                return;
            }
            setResult(r);
            setScreen("resultat");
            if (r.economieAnnuelle > 0) {
                setHistory((h) => [{ id: run, fournisseur: r.fournisseur, economie: r.economieAnnuelle, devise: r.devise }, ...h]);
            }
            if (r.anomalies.length > 0)
                writeLetter(r, run);
        }
        catch (e) {
            if (run !== runRef.current)
                return;
            setErrorKey("echec");
            setScreen("erreur");
        }
    }, [writeLetter]);
    const pickFile = () => {
        if (fileRef.current)
            fileRef.current.click();
    };
    const onFile = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file)
            return;
        try {
            if (file.type === "application/pdf") {
                if (file.size > 8 * 1024 * 1024) {
                    setErrorKey("gros");
                    setScreen("erreur");
                    return;
                }
                const url = await lireDataUrl(file);
                analyse({ kind: "pdf", name: file.name }, [
                    { type: "document", source: { type: "base64", media_type: "application/pdf", data: url.split(",")[1] } },
                    { type: "text", text: "Analyse cette facture." },
                ]);
            }
            else if (file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)) {
                const img = await lireImage(file);
                analyse({ kind: "image", preview: img.preview, name: file.name }, [
                    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img.data } },
                    { type: "text", text: "Analyse cette facture." },
                ]);
            }
            else {
                setErrorKey("format");
                setScreen("erreur");
            }
        }
        catch (err) {
            setErrorKey("format");
            setScreen("erreur");
        }
    };
    const onExemple = () => analyse({ kind: "exemple" }, "Voici le texte d'une facture :\n\n" + TEXTE_EXEMPLE);
    const onCancel = () => {
        runRef.current++;
        setScreen("home");
    };
    const onTranslate = async () => {
        setTrad({ status: "loading", text: "" });
        try {
            const text = await askClaude(SYSTEM_TRADUCTION, letter.text);
            setTrad({ status: "ok", text });
        }
        catch (e) {
            setTrad({ status: "erreur", text: "" });
        }
    };
    const onCopy = async () => {
        let ok = false;
        try {
            await navigator.clipboard.writeText(letter.text);
            ok = true;
        }
        catch (e) {
            /* on tente la méthode de secours */
        }
        if (!ok) {
            try {
                const ta = document.createElement("textarea");
                ta.value = letter.text;
                ta.setAttribute("readonly", "");
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                ok = document.execCommand("copy");
                document.body.removeChild(ta);
            }
            catch (e) {
                ok = false;
            }
        }
        setCopy(ok ? "ok" : "ko");
        setTimeout(() => setCopy("idle"), 2500);
    };
    return (React.createElement("div", { className: "nz", lang: "fr" },
        React.createElement("style", null, CSS),
        React.createElement("input", { ref: fileRef, type: "file", accept: "image/*,.heic,.heif,application/pdf", onChange: onFile, style: { display: "none" }, tabIndex: -1, "aria-hidden": "true" }),
        React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
            screen === "home" && React.createElement(Accueil, { onScan: pickFile, onExemple: onExemple, history: history }),
            screen === "analyse" && React.createElement(Analyse, { source: source, onCancel: onCancel }),
            screen === "erreur" && React.createElement(Erreur, { errorKey: errorKey, onScan: pickFile, onHome: () => setScreen("home") }),
            screen === "resultat" && result && (React.createElement(Resultat, { r: result, letter: letter, onLetter: (text) => setLetter({ status: "ok", text }), onRetryLetter: () => writeLetter(result, runRef.current), trad: trad, onTranslate: onTranslate, copy: copy, onCopy: onCopy, onBack: () => setScreen("home"), onScan: pickFile })))));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(LeNegociateur));
