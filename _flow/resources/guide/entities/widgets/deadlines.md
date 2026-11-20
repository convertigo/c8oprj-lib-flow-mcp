# Échéances, retards et alertes

Read for a due queue, status filters, its counter and the background alert interface.

## Le calcul disponible

Le trait `Échéance` ajoute `dateEcheance` et `statut`, calculés en SQL à chaque
lecture : filtres, tri et compteur emploient le même calcul. Ces champs ne
s'écrivent jamais avec `entity.save`. Le badge du statut constitue le marquage
minimal ; il apparaît au prochain chargement, même sans modification de la ligne.
Le passage du temps ne déclenche ni événement, ni message, ni rafraîchissement
spontané d'une page ouverte.

- `reference` : une ou plusieurs dates stockées (`date` ou `timestamp`), toutes
  publiques, sans `secret`, sans `visibleTo`, sans calcul. Par défaut
  (`referenceMode: "latest"`), la plus récente des valeurs non nulles est retenue. Un timestamp est une heure locale stockée ;
  sa partie date sert de référence.
- `referenceMode: "first"` : retient la première référence non nulle dans l’ordre
  donné, même si elle est antérieure aux suivantes. Exemple :
  `reference: ["lastReview", "deliveredOn"]`.
  Sans valeur non nulle, la date reste nulle.
- `delay` : mois entiers de 0 à 120, puis jours **calendaires** de 0 à 3660.
  Les mois ajustent une fin de mois au dernier jour disponible. Pas de jours
  ouvrés, de week-ends exclus ou de calendrier de jours fériés dans ce trait.
  Ne pas inventer `businessDays` ; un calendrier métier demande un autre contrat.
- `timeZone` : jour courant de la comparaison, `Europe/Paris` par défaut.
  Donner aussi le `timeZone` du modèle pour les horodatages automatiques.
- `inclusive: true` : à suivre dès le jour de l'échéance ; `false`, le défaut,
  à partir du lendemain. Sans aucune référence renseignée, `dateEcheance` vaut
  null et le statut est déjà « À suivre » : ce n'est pas un retard daté.
- Codes par défaut : `aJour` et `aRelancer`. `upToDate` et `due` les remplacent
  par deux identifiants distincts ; labels et tons suivent dans `describe`.

Les références restreintes sont refusées au contrôle **et au chargement** du
modèle, y compris après composition de traits. Le secours de lecture ne calcule
rien à partir d'une entrée masquée et respecte la visibilité propre de chaque
sortie. Filtres, tri et compteur passent par les contrôles de champs du serveur ;
une colonne ou un filtre frontend ne peut pas restaurer un champ omis.
Les erreurs publiques restent génériques ; les détails du modèle sont réservés
à l'outillage d'auteur et aux journaux serveur.

## Exemple : contrôles liés à un site

Installer `app.entityAccess` avec la politique de session adaptée à l'application
(`flow://guide/entities/policy`). Enregistrer ce modèle avec
`flow-entity-model-set`, `gateway: true`, puis initialiser selon
`flow://guide/entities/model`. Un rôle `USER` peut lire ; les écritures sont
réservées à `MANAGER`. Ne pas exposer l'initialisation comme commande publique.

<!-- example: deadline-model -->
```json
{
  "version": 2,
  "timeZone": "Europe/Paris",
  "entities": {
    "Site": {
      "display": {"title": "nom"},
      "permissions": {"read": ["USER", "MANAGER"], "create": ["MANAGER"], "update": ["MANAGER"], "delete": []},
      "fields": {"nom": {"type": "string", "maxLength": 120}}
    },
    "Controle": {
      "display": {"title": "libelle"},
      "permissions": {"read": ["USER", "MANAGER"], "create": ["MANAGER"], "update": ["MANAGER"], "delete": []},
      "traits": ["Révisé", "Activable", {"Échéance": {"reference": ["dateControle"], "delay": {"months": 2, "days": 15}, "timeZone": "Europe/Paris", "inclusive": true}}],
      "fields": {
        "libelle": {"type": "string", "maxLength": 120},
        "siteId": {"type": "int64", "relation": {"entity": "Site", "labelField": "nom"}},
        "dateControle": {"type": "date", "nullable": true}
      }
    }
  }
}
```

Cette page ouvre les contrôles actifs par échéance croissante ; le filtre de
statut est initialisé sur « À suivre », et « Tous » permet de voir aussi les
contrôles à jour. Le compteur conserve son sens « À suivre » indépendamment
du choix du filtre. Pour une liste fixe, remplacer `filters` par
`filter={{statut:"aRelancer"}}`. Avec des codes renommés, adapter les deux filtres.

<!-- example: deadline-queue -->
```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "relances", title: "À suivre" } };</script>
<FlowComponent $$id="deadlineQueue">
  <Variables><State $$id="refresh" type="number" value={0} /></Variables>
  <Structure><ColumnLayout $$id="queue"><Children>
    <EntityStat $$id="dueCount" entity="Controle" label="À suivre" tone="warning"
      filter={{statut:"aRelancer"}} refreshKey="@page.refresh" />
    <EntityTable $$id="dueRows" entity="Controle" caption="Contrôles à suivre"
      columns={["libelle","siteId","dateEcheance","statut"]}
      filters={[{field:"statut",value:"aRelancer"}]}
      orderBy="dateEcheance" direction="asc" pageSize={10} refreshKey="@page.refresh" />
    <Button $$id="reload" label="Actualiser"><Events><OnClick $$id="refreshQueue"><Actions>
      <UpdateNumber $$id="incrementRefresh" target="page.refresh" operation="increment" step={1} />
    </Actions></OnClick></Events></Button>
  </Children></ColumnLayout></Structure>
</FlowComponent>
```

`orderBy` et `direction` fixent le tri serveur initial ; les en-têtes restent
triables. Un changement de ces propriétés ou de l'identité (`refreshKey`,
session, entité) rétablit ce tri et remet pagination et sélection à zéro.
Le compteur porte sur toutes les lignes autorisées, pas la page de dix lignes.
Le libellé du badge, avec son ton `warning`, rend l'alerte lisible sans dépendre
uniquement d'une couleur. `dateEcheance` est explicitement demandée car le trait
la masque par défaut dans les colonnes (`table: false`).
Après une sauvegarde, un changement de session ou un nouveau passage du job,
changer `page.refresh` pour recharger compteur et liste. Le bouton permet de
le faire quand le jour a changé. Deux requêtes séparées autour de minuit ou
d'une écriture concurrente ne constituent pas une photographie transactionnelle.

## Interface avec le chantier des tâches de fond

Contrat à implémenter par l'application et son job, pas une nouvelle API fournie
par la bibliothèque :

1. **Sélection** : le job lit `entity.list` avec un acteur de service explicite,
   `checkAccess: true`, un filtre `{statut:"aRelancer"}` et des lots bornés.
   La réponse est celle de la liste : `rows`, `hasMore` ; chaque ligne contient
   `key`, `values.dateEcheance`, `values.statut` et, avec `Révisé`, `revision`.
   Le compteur emploie `entity.count` avec le même filtre et le même périmètre.
   Ne pas parcourir par offsets une liste qui rétrécit pendant le traitement :
   conserver les clés candidates d'un lot, ou déléguer le curseur stable au job.
2. **Marquage minimal** : le statut calculé et son badge suffisent à signaler
   le retard à la prochaine lecture. Aucun champ d'alerte ni état « déjà envoyé »
   n'est ajouté implicitement par `Échéance`.
3. **Message optionnel** : avant envoi, relire la clé sous la politique du job,
   vérifier qu'elle est toujours à suivre et que l'échéance est inchangée.
   L'application conserve une occurrence identifiée par `(entity, key,
   dateEcheance, statut)` ; une référence manquante est une occurrence explicite
   à date nulle. Une nouvelle échéance peut produire une nouvelle occurrence.
   Réserver cette occurrence atomiquement avant traitement concurrent. L'envoi
   et les reprises requièrent une boîte d'envoi et/ou une clé d'idempotence du
   fournisseur : ne pas promettre un envoi unique avec un simple champ booléen.
4. **Sortie** : le job publie son résumé d'exécution et un signal de
   rafraîchissement pour les pages. Le stockage des occurrences, les destinataires,
   le planificateur et le transport restent au chantier des tâches de fond.

Une politique de service refuse toujours les dates ou sorties restreintes ;
ne pas recevoir `checkAccess` depuis une entrée HTTP, ni contourner les contrôles
avec du SQL direct. Les messages n'emportent que les champs autorisés utiles.
