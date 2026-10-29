# Application Flow multi-pages avec rôles

Cette recette construit une petite application de réservation de salles : un utilisateur voit ses réservations ; un gestionnaire voit toutes les réservations et le journal. Le sample `sampleFlowRoles` est une démonstration locale, avec une connexion de démonstration désactivée par défaut.

## 1. Préparer les contrats

Lire `flow://guide/start`, `flow://guide/authoring` et `flow://guide/frontend-svelte`. Ajouter les références proposées par `flow-catalog` : `lib_flow_sql`, `lib_flow_crud_data`, `lib_flow_frontend_data_svelte` et le frontbuilder Svelte. Lire `flow://lib/lib_flow_sql/sql` pour la configuration et `flow://lib/lib_flow_crud_data/csv` pour l'export. Inspecter les contrats réels avant d'écrire les appels ; un catalogue disponible ne prouve pas qu'une connexion est configurée.

Créer d'abord le schéma, les données de démonstration et les Flows serveur, puis les pages. Déclarer les paramètres typés ; les identifiants `int64` restent des textes. Déclarer `items: {type:"object"}` pour un tableau d'objets. Les symboles de plateforme appartiennent à la configuration, avec des valeurs de démonstration désactivées par défaut ; aucun secret dans le source, les sorties ou les journaux.

## 2. Installer les données et la session

Configurer `config.sql.connections`, le schéma et les données séparés, puis appeler `sql.initialize`. HSQLDB est une base de développement : chemin relatif au projet sous `_flow/resources/sql/`, hors `_private`, protégé par `.httpignore`. Un CAR remplace cette base ; utiliser un SGBD externe en production. Ignorer dans Git les fichiers de base créés par les tests. Une initialisation rejouée doit préserver les écritures de l'utilisateur ; une remise à zéro reste explicite et réservée à la démonstration.

En production, appeler un fournisseur d'authentification réel, par exemple les Flows de `lib_UserManager`. `session.authenticate` établit une identité ; il ne vérifie pas un mot de passe. Un sélecteur Alice/Bob/Gestionnaire n'est acceptable que derrière une configuration de démonstration, jamais comme écran de connexion de production.

Créer un Flow `CurrentUser` qui lit `session.authenticatedUser`, recherche le compte côté serveur, vérifie qu'il est actif et retourne son rôle. Ne prendre ni identité ni rôle depuis la page. Refuser une session absente (`UNAUTHENTICATED`, 401) ou un compte désactivé/non autorisé (`FORBIDDEN`, 403). Un Flow public de contrôle de session peut répondre normalement `{authenticated:false}` pour l'accueil anonyme. Pour la déconnexion, appeler `session.authenticate({user:""})`, effacer l’état affiché et désactiver le rejeu automatique des identifiants ; le cookie ne doit plus autoriser une lecture protégée. Dans son `CallSequence`, passer une `Variable` nommée `__disableAutologin` avec `value={true}` : sinon le SDK peut rejouer la connexion au lieu de terminer la déconnexion.

## 3. Imposer le périmètre côté serveur

Déclarer les façades appelées par les pages avec `_flow.accessibility:"hidden"` et `authenticatedContextRequired:true`. `hidden` masque la découverte mais n'interdit pas HTTP ; `private` est destiné aux appels internes. Écrire ces noms en minuscules dans FlowScript. Garder les initialisations et le traitement planifié privés.

Pour chaque lecture ou écriture, rappeler `CurrentUser`. Le serveur choisit `ownerId` et les droits. Dans une lecture nommée, joindre le périmètre obligatoire au filtre facultatif, par exemple `(:manage=TRUE OR OWNER_ID=:ownerId) AND (:status='' OR STATUS=:status)`. `manage` et `ownerId` viennent du serveur. Les requêtes exposées par une façade ne deviennent pas publiques automatiquement : déclarer `readOnly:true`, garder `expose:false` et utiliser des paramètres liés. `SQL_QUERY_READONLY_REQUIRED` signale l'oubli du premier attribut.

Préférer `sql.table` et `data.read`/`data.write` pour le CRUD. Une requête nommée convient à une jointure bornée. Valider filtres, colonnes et tri sur des listes blanches ; ne jamais concaténer du SQL fourni par le client. Refuser un filtre non autorisé (`BOOKING_FILTER_INVALID`) et un tri inconnu (`BOOKING_ORDER_INVALID`). Pour une modification, relire la ligne, vérifier son propriétaire ou le rôle gestionnaire, puis transmettre sa révision au contrat data. Ne pas accepter un patch arbitraire du navigateur.

## 4. Construire des pages distinctes

Créer les pages cibles avant les liens : accueil/connexion, mes réservations, gestion et journal. Un Layout porte la navigation et `PageContent`. Chaque page contrôle la session avant de charger ses données. Les liens de gestion sont visibles seulement au gestionnaire ; le serveur applique toujours le même contrôle.

Afficher chargement, vide et erreurs avec les composants standard et `Status`. Après `CallSequence`, utiliser les résultats déclarés et des actions de palette ; une chaîne utilisateur doit continuer même si son panneau disparaît. Rafraîchir la session du Layout après une navigation. Ne pas employer un HTTP 200 de la route comme preuve que la grille est alimentée.

Adapter une réponse Resource/Page avec `dataUi.gridPage`, puis lier ses colonnes et lignes à la DataGrid. Un dataset client doit être explicitement complet et borné ; au-delà, renvoyer une erreur de limite plutôt qu'une liste tronquée présentée comme complète. Les métadonnées `filterOps` et `sortable` doivent refléter les seuls filtres et tris acceptés par le serveur.

## 5. Exporter la même liste

Lire aussi `flow://lib/lib_flow_frontend_data_svelte/csv`. La DataGrid en mode export serveur produit une photographie de ses filtres, tri et colonnes. Enchaîner `DataUiGridExportRequest`, `CallSequence` et `FileDownload`. Utiliser les variantes `filterJson` et `columnsJson` aux frontières HTTP lorsque nécessaire ; parser puis valider côté serveur.

La façade d'export réutilise le contrôle d'accès et la lecture filtrée ; la pagination de l'écran ne réduit pas l'export. Utiliser `data.csv` pour des lignes déjà complètes, ou `data.exportCsv` pour une source data. Fixer une borne de lignes et d'octets. Le CSV français utilise `;`, UTF-8 avec BOM et `dd/MM/yyyy`, avec neutralisation des formules. Une façade `.bin` utilise `file.respond` pour `Content-Type` et `Content-Disposition`. Tester également ses erreurs et son refus anonyme.

## 6. Planifier et tracer

Un traitement autonome ne dépend pas du cookie d'un navigateur. Il appelle un Flow privé dédié, borné, qui vérifie sa configuration, utilise `date.today`/`date.add` dans le fuseau choisi et produit un résultat comptable. Inspecter `scheduler-list`, puis créer le job avec le relais `scheduler-apply` ; conserver un nom propre au projet. Tester une exécution réelle et l'idempotence avant d'activer une fréquence régulière.

En démonstration, enregistrer une notification `SIMULATED` et une entrée de journal dans la même `sql.transaction`, avec une clé unique de répétition. Ne pas prétendre avoir envoyé un message. Pour un envoi réel, utiliser `email.send` et le SMTP de plateforme ; commencer avec un serveur de capture. Ne pas journaliser de mot de passe, jeton ni corps sensible. Le journal persistant contient acteur, opération, objet et date ; l'accès est contrôlé côté serveur. Un journal écrit après une mutation n'est pas atomique avec elle : utiliser une transaction si cette garantie est nécessaire.

## 7. Prouver le parcours

Tester les dates et les contrats dans des Flows de test privés. Pour HTTP, ouvrir une session et conserver son cookie dans un jar distinct pour Alice, Bob et le gestionnaire ; une connexion `code-run` ne prouve pas la session de l'appel HTTP suivant. Vérifier : anonyme refusé, données cloisonnées, identité falsifiée ignorée, mutation d'autrui refusée, rôle révoqué relu, révision périmée, filtre/tri invalides, CSV identique à la liste filtrée, job rejoué sans doublon, journal et déconnexion avec ancien cookie inutilisable.

Enfin ouvrir le viewer, naviguer avec chaque rôle, vérifier les lignes visibles, les appels réseau et le fichier téléchargé. Après chaque outil MCP, lire `result.error`, son code et son message avant de réessayer. `FLOW_INPUT_REQUIRED` et `FLOW_INPUT_TYPE_INVALID` indiquent un contrat d'entrée ; `FLOW_CODE_UNSAVED_WORKING_COPY` demande de reprendre la révision indiquée. Conserver tests et sources dans Git, sans données d'exécution ni secrets.
