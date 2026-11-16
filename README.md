# Simulateur REP : notice des modèles et du code

Projet Procom, IMT Atlantique. Cette notice relie chaque partie du code aux fiches de l'équipe
(fiche neutronique, fiches thermohydrauliques 900 et 1300 MWe) et liste les écarts assumés.

Les numéros entre parenthèses, par exemple (25), sont les numéros d'équation des fiches.
Les « H12 », « H13 »... sont les hypothèses des fiches.

## 1. Lancer, modifier, reconstruire

| Besoin | Comment |
|---|---|
| Jouer | Ouvrir `simulateur-rep.html` dans un navigateur (Chrome, Edge, Firefox). Aucun serveur, aucune installation, fonctionne hors ligne. |
| Modifier un modèle | Éditer le fichier concerné dans `src/`, puis ouvrir `src/dev.html` (charge les fichiers séparément) ou reconstruire. |
| Reconstruire le fichier unique | `node build.js` (Node 16 ou plus, aucune dépendance). |
| Rejouer les essais | `node tests/t9_contenus.js 900` ou `1300` : un robot joue le cours, les 6 missions et les 8 incidents. |
| Contrôler le cours à l'écran | `node tests/nav.js cours tout` (Playwright) : vérifie pour chaque étape que la bulle tient dans l'écran et ne cache pas sa cible. |

## 2. Organisation du code

La physique ne contient aucun code d'affichage, et l'interface ne contient aucun calcul de centrale.

| Fichier | Rôle |
|---|---|
| `src/eau.js` | Propriétés de l'eau (tables IAPWS-IF97 : saturation de 1 à 220 bar, liquide à 155 bar). |
| `src/params.js` | **Tous les paramètres.** `REP.PALIERS[900]` et `[1300]` (géométrie, débits, températures), `REP.COMMUN` (neutronique, régulations, seuils), `REP.CYCLES` (début, milieu, fin de cycle). |
| `src/neutronique.js` | Cinétique ponctuelle, grappes, contre-réactions, xénon, puissance résiduelle. |
| `src/thermo.js` | Circuit primaire par nœuds, crayon combustible, pompes et circulation naturelle, pressuriseur, générateurs de vapeur, turbine. |
| `src/surete.js` | Protections (AAR), injection de sécurité, ASG, RCV, et les 8 incidents. |
| `src/moteur.js` | Assemble les modèles. `REP.creer({palier, cycle, etat})` renvoie `sim` avec `sim.s` (état), `sim.u` (commandes), `sim.avancer(durée)`. |
| `src/ui/widgets.js` | Cadrans à aiguille, curseurs verticaux, courbes. |
| `src/ui/synoptique.js` | Vue en coupe animée (s'adapte à 3 ou 4 boucles). |
| `src/ui/guide.js` | Moteur de guidage : projecteur, flèche, bulle, temps figé. |
| `src/ui/cours.js` | **Le cours pour débutants (mission 0)** : 49 étapes en temps figé, avec schémas. Chargé avant `contenus.js`. |
| `src/ui/contenus.js` | **Le reste du contenu pédagogique** : visite guidée, missions 1 à 6, guidage des incidents, glossaire. |
| `src/ui/app.js` | Boucle temps réel, branchement des commandes, alarmes, fenêtres. |

Ordre de calcul à chaque pas (fiche thermo 2.6) : neutronique, hydraulique, combustible, eau,
pressuriseur, contre-réactions. Pas de temps : 0,05 s jusqu'à ×5, 0,1 s jusqu'à ×60, 0,2 s au-delà.

## 3. Neutronique (`neutronique.js`)

| Modèle | Équations | Remarques |
|---|---|---|
| Cinétique ponctuelle à 6 groupes de neutrons retardés | (1) à (7) | Euler implicite. Sous-pas automatiques si la réactivité dépasse β. |
| Efficacité intégrale des grappes | (B3) f(x) = x − sin(2πx)/2π | Courbe en S. |
| Réactivité des grappes | (B4) ρ = −W·(f(x) − f(x0)) | Groupe R : 2500 pcm. Groupe S : 4000 pcm. |
| Bilan de réactivité | (35) | Grappes + Doppler + modérateur + bore + xénon. |
| Puissance thermique | (36) | P = P0·n + puissance résiduelle. |

Coefficients (milieu de cycle) : Doppler −2,5 pcm/°C, modérateur −35 pcm/°C, bore −10 pcm/ppm,
β effectif 598 pcm. Le coefficient modérateur et le bore changent avec le cycle (`REP.CYCLES`).

Ajouts par rapport à la fiche :

- **Xénon et iode 135** : deux équations différentielles, pour les variations de charge longues (mission 3).
- **Puissance résiduelle** : 8 groupes ajustés sur la loi de Way-Wigner (environ 6 % à l'arrêt, 1,5 % à 15 min).
- **Source de neutrons** : nécessaire pour démarrer depuis l'arrêt (mission 4).
- **Vitesse des grappes limitée** à 72 pas/min (H11 levée) : la position réelle suit la consigne.

## 4. Thermohydraulique (`thermo.js`)

| Modèle | Équations | Remarques |
|---|---|---|
| Débit cœur | (8) | Déduit du bilan d'enthalpie à 100 %. |
| Profil radial du crayon | (20) à (24), Dittus-Boelter (21) | Onglet « Crayon combustible ». Crayon chaud : facteur F_Q = 2,3 (H19). |
| Nœud combustible | (25), résistance thermique (27) | |
| Nœud eau du cœur | (26) | Voir écart n° 2. |
| Nœuds de transport (plénums, branches, GV) | (28) | Schéma amont implicite, stable à toute vitesse du temps. |
| Générateur de vapeur | (29) Q = UA·(T primaire − Tsat secondaire) | |
| Pompes : ralentissement | (14) à (17) | ω = ω0/(1 + t/τp). |
| Circulation naturelle | (18)(19) | Quelques pour cent du débit nominal, pompes arrêtées. |
| Pressuriseur | (30) à (34) | Modèle 2 (équilibre liquide-vapeur) + terme transitoire (31). |

## 5. Écarts assumés par rapport aux fiches

1. **Boucles séparées** (H13 levée) : 3 boucles sur le 900, 4 sur le 1300, chacune avec son GV. C'est ce qui permet d'isoler un seul GV dans le RTGV.
2. **Nœud eau du cœur** : l'état calculé est la température de sortie du cœur, pas la température moyenne. Sans cela le régime permanent ne retombait pas sur 286/323 °C.
3. **Chaleur massique calibrée** : cp du primaire est ajusté pour que le bilan (8) donne exactement la puissance nominale. Régime permanent vérifié : 286/323 °C, 155 bar, 58 bar vapeur (900) ; 292,8/328,4 °C, 64,5 bar (1300).
4. **Pressuriseur** : modèle 2 à l'équilibre, plus le terme (31) du modèle 1 relaxé en 4 s pour reproduire la surpression transitoire. Quand le pressuriseur se vide, le primaire passe à la saturation de son point le plus chaud et le manque d'eau devient un volume de vapeur dans la cuve.
5. **Secondaire** : chaque GV est une masse d'eau saturée (bilans de masse et d'énergie). Turbine avec régulateur de charge à 30 %/min, contournement au condenseur (GCT), décharge à l'atmosphère, soupapes GV, eau alimentaire ARE et secours ASG. Rien de cela n'est dans les fiches : c'est le minimum pour jouer les transitoires.
6. **Marge à la crise d'ébullition (REC)** : indicateur simplifié, calé à 2,1 à 100 %, pas une corrélation de flux critique.
7. **Contournement après arrêt** : capacité réduite à un quart, sinon le refroidissement était irréaliste.
8. **Régulation automatique des grappes** : écart de température moyenne + écart de puissance, bande morte ±0,8 °C. En îlotage, elle vise 30 % de puissance.

## 6. Protections et sauvegardes (`surete.js`)

| Automatisme | Seuil |
|---|---|
| AAR haut flux | 109 % |
| AAR basse / haute pression primaire | 131 bar / 165 bar |
| AAR bas débit primaire | 88 % (au-dessus de 10 % de puissance) |
| AAR très bas niveau GV | 25 % |
| Soupape du pressuriseur | ouverture 166 bar, fermeture 160 bar |
| Injection de sécurité | 121 bar, ou chute rapide de la pression vapeur |
| Décharge vapeur à l'atmosphère | pression vapeur à vide + 6 bar (76 bar sur le 900) |
| ASG | niveau GV sous 30 %, ou perte de l'eau alimentaire |

Tous les seuils sont dans `REP.COMMUN` (`params.js`).

## 7. Contenu pédagogique (`ui/cours.js`, `ui/contenus.js`)

- **Mission 0, « Comprendre une centrale »** (public : lycéens, aucun prérequis, 15 min, aucune manipulation). Partie 1 : la centrale comme une bouilloire, fission, réaction en chaîne (dominos), neutrons retardés, eau modératrice et contre-réaction, grappes, bore, puissance résiduelle, trois circuits, pressuriseur (cocotte-minute), générateur de vapeur, turbine et rendement, trois barrières. Partie 2 : chaque cadran, curseur, bouton et onglet, un par un (à quoi il sert, une comparaison, quand l'utiliser). Proposée en premier sur l'écran d'accueil, accessible aussi par 🎯 Missions et ❔ Aide. La mission 1 reste ouverte sans passer par le cours.
- **Visite guidée** : 14 étapes, temps figé, chaque zone de l'écran mise en évidence.
- **6 missions** (inchangées), qui débloquent les commandes progressivement : prise en main (turbine), grappes, bore et xénon (temps accéléré), démarrage, arrêt d'urgence et chaleur résiduelle (pompes, pressuriseur), accident RTGV (tout).
- **8 incidents** déclenchables à tout moment : RTGV, rupture de tuyauterie vapeur, soupape du pressuriseur bloquée ouverte, perte du réseau, îlotage, perte des pompes primaires, perte de l'eau alimentaire, dilution du bore.

**Affichage simplifié (plan B, désactivé par défaut).** Case à cocher sur l'écran d'accueil, bouton 👁 de la barre du haut, ou ⚙ Options. L'écran ne garde que l'essentiel, de façon fixe : 3 ou 4 cadrans (puissance réacteur, puissance électrique, température moyenne, pression), les commandes débloquées par la mission, **jamais** le panneau de courbes. Rien n'apparaît en cours de route, sauf une commande qu'une étape d'action demande de manœuvrer (par exemple la vanne vapeur pendant un RTGV). Les explications qui portent sur un élément caché sont sautées automatiquement : en simplifié, le cours passe de 49 à 31 étapes. En mode normal, rien n'est modifié : le cours présente tout, et la mission 1 commence par la visite guidée de tout l'écran. Ni la physique ni les objectifs ne dépendent de l'affichage. Code : `App.simplifier`, `App.cache`, `App.reveler` dans `ui/app.js`, saut d'étape dans `ui/guide.js`, règles `body.simple` dans `style.css` ; la base de chaque mission est `debloque` (ou `vueCles`) et `cadrans` dans sa définition. Une étape marquée `garde: true` est conservée même si sa cible est cachée.

Une étape de guidage est un objet : `{ cible, titre, texte, attend, afaire, fais }`. Sans `attend`,
c'est une explication (temps figé, bouton Suivant). Avec `attend`, c'est une action : le temps tourne
et on avance quand la condition est vraie. `fais` exécute l'action à la place du joueur.
Pour ajouter un incident : une entrée dans `INCIDENTS` (`surete.js`) et une dans `GUIDES` (`contenus.js`).

## 8. Ce qui a été vérifié, et les limites

Vérifié par simulation automatique sur les deux paliers : régime permanent exact à 100 %, variations
de charge, arrêt automatique (1,5 % de puissance résiduelle à 15 min), circulation naturelle (5 à 6 %),
îlotage, démarrage depuis l'arrêt à chaud, pic xénon. Le cours, les 6 missions et les 8 incidents guidés se
terminent sans blocage, en simulation et dans le navigateur.

Limites à connaître avant de présenter le simulateur :

- C'est un **outil pédagogique**. Les ordres de grandeur sont réalistes, mais les données sont indicatives et aucune valeur n'est validée contre une centrale réelle ou un code de référence.
- Les vitesses sont accélérées par rapport à la réalité : variation de charge à 30 %/min, refroidissement RTGV en 2 minutes.
- Après un RTGV maîtrisé, la pression du GV isolé continue de dériver : sans ajustement de la consigne, la fuite reprend lentement.
- Après une rupture de tuyauterie vapeur, la marge à la saturation repasse sous 10 °C pendant le réchauffage, avant de se rétablir.
- Pressuriseur plein d'eau : comportement approché (pas de vrai modèle « solide »).
- Le cours (mission 0) cite des ordres de grandeur grand public à faire relire par l'équipe : environ deux tiers de l'électricité française, une pastille équivalente à environ une tonne de charbon, enrichissement de 3 à 5 %, puissance résiduelle de 6 % puis 1,5 %, rendement d'un tiers.
- Pas de répartition axiale de puissance, pas de groupes gris, pas de régulation fine du niveau GV.
