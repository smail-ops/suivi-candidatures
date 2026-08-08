"""Suite de tests end-to-end de l'application Suivi_candidatures.

Couverture : affichage initial, filtres, recherche, ajout, édition,
suppression, changement de statut, persistance, vue statistiques et export CSV.

Référencement des cas : CT-SC1 à CT-SC13.
"""

import re

import pytest
from playwright.sync_api import expect

from conftest import NB_PISTES_INITIALES


# --------------------------------------------------------------------------
# Affichage initial
# --------------------------------------------------------------------------


def test_ct_sc1_chargement_initial(app, cartes):
    """CT-SC1 — Le jeu de démonstration est chargé et le compteur est cohérent."""
    expect(cartes).to_have_count(NB_PISTES_INITIALES)
    expect(app.get_by_test_id("compteur")).to_contain_text("4 pistes")
    expect(app.get_by_role("heading", name="Entreprise Exemple SA")).to_be_visible()


def test_ct_sc2_delai_sans_reponse_affiche(app, cartes):
    """CT-SC2 — Une piste « en attente » affiche son ancienneté en jours."""
    carte_attente = cartes.filter(has_text="Entreprise Exemple SA")
    expect(carte_attente).to_contain_text(re.compile(r"\d+ j"))


# --------------------------------------------------------------------------
# Filtres et recherche
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "filtre, entreprise_attendue",
    [
        ("En attente", "Entreprise Exemple SA"),
        ("Refusé", "Société Démo"),
        ("Vivier", "Client Fictif"),
        ("Sans suite", "Contact Réseau"),
    ],
)
def test_ct_sc3_filtre_par_statut(app, cartes, filtre, entreprise_attendue):
    """CT-SC3 — Chaque filtre de statut ne laisse que les pistes concernées."""
    app.get_by_role("button", name=filtre, exact=True).click()
    expect(cartes).to_have_count(1)
    expect(cartes).to_contain_text(entreprise_attendue)


def test_ct_sc4_filtre_toutes_restaure_la_liste(app, cartes):
    """CT-SC4 — Le filtre « Toutes » réaffiche l'intégralité des pistes."""
    app.get_by_role("button", name="Refusé", exact=True).click()
    expect(cartes).to_have_count(1)

    app.get_by_role("button", name="Toutes", exact=True).click()
    expect(cartes).to_have_count(NB_PISTES_INITIALES)


def test_ct_sc5_recherche_par_entreprise(app, cartes):
    """CT-SC5 — La recherche filtre la liste sur le nom de l'entreprise."""
    app.get_by_placeholder("Rechercher (entreprise, poste, note)").fill("Fictif")
    expect(cartes).to_have_count(1)
    expect(cartes).to_contain_text("Client Fictif")


def test_ct_sc6_recherche_sans_resultat(app, cartes):
    """CT-SC6 — Une recherche infructueuse affiche le message d'état vide."""
    app.get_by_placeholder("Rechercher (entreprise, poste, note)").fill(
        "entreprise-inexistante"
    )
    expect(cartes).to_have_count(0)
    expect(app.get_by_text("Aucune piste ne correspond.")).to_be_visible()


# --------------------------------------------------------------------------
# Ajout
# --------------------------------------------------------------------------


def test_ct_sc7_ajout_candidature(app, cartes):
    """CT-SC7 — Une piste ajoutée apparaît en tête de liste et incrémente le compteur."""
    app.get_by_label("Ajouter une candidature").click()

    formulaire = app.get_by_test_id("add-form")
    expect(formulaire).to_be_visible()
    formulaire.get_by_label("Entreprise *").fill("ALTEN")
    formulaire.get_by_label("Poste").fill("QA Automaticien")
    formulaire.get_by_role("button", name="Ajouter").click()

    expect(cartes).to_have_count(NB_PISTES_INITIALES + 1)
    expect(cartes.first).to_contain_text("ALTEN")
    expect(app.get_by_test_id("compteur")).to_contain_text("5 pistes")


def test_ct_sc8_ajout_refuse_sans_entreprise(app):
    """CT-SC8 — Le bouton d'ajout reste désactivé tant que l'entreprise est vide."""
    app.get_by_label("Ajouter une candidature").click()

    formulaire = app.get_by_test_id("add-form")
    bouton_ajouter = formulaire.get_by_role("button", name="Ajouter")
    expect(bouton_ajouter).to_be_disabled()

    formulaire.get_by_label("Entreprise *").fill("ALTEN")
    expect(bouton_ajouter).to_be_enabled()


# --------------------------------------------------------------------------
# Édition, statut, suppression
# --------------------------------------------------------------------------


def test_ct_sc9_changement_de_statut(app, cartes):
    """CT-SC9 — Changer le statut depuis la carte met à jour badge et compteur."""
    carte = cartes.filter(has_text="Entreprise Exemple SA")
    carte.get_by_test_id("card-statut").select_option("refuse")

    expect(carte).to_contain_text("REFUSÉ")
    expect(app.get_by_test_id("compteur")).to_contain_text("2 refus")


def test_ct_sc10_edition_candidature(app, cartes):
    """CT-SC10 — Une modification enregistrée est reflétée sur la carte."""
    carte = cartes.filter(has_text="Entreprise Exemple SA")
    carte.get_by_label("Modifier").click()

    edition = app.get_by_test_id("candidature-edit")
    expect(edition).to_be_visible()
    edition.get_by_label("Poste").fill("Ingénieur QA")
    edition.get_by_role("button", name="Enregistrer").click()

    expect(cartes.filter(has_text="Entreprise Exemple SA")).to_contain_text(
        "Ingénieur QA"
    )


def test_ct_sc11_suppression_avec_confirmation(app, cartes):
    """CT-SC11 — La suppression exige un second clic de confirmation."""
    carte = cartes.filter(has_text="Client Fictif")
    carte.get_by_label("Supprimer").click()

    # Premier clic : rien n'est supprimé, le bouton passe en confirmation.
    expect(cartes).to_have_count(NB_PISTES_INITIALES)

    carte.get_by_label("Supprimer").click()
    expect(cartes).to_have_count(NB_PISTES_INITIALES - 1)
    expect(app.get_by_text("Client Fictif")).to_have_count(0)


# --------------------------------------------------------------------------
# Persistance
# --------------------------------------------------------------------------


def test_ct_sc12_persistance_apres_rechargement(app, cartes):
    """CT-SC12 — Les données saisies survivent à un rechargement de page."""
    app.get_by_label("Ajouter une candidature").click()
    formulaire = app.get_by_test_id("add-form")
    formulaire.get_by_label("Entreprise *").fill("Persistance SA")
    formulaire.get_by_role("button", name="Ajouter").click()
    expect(cartes).to_have_count(NB_PISTES_INITIALES + 1)

    app.reload()
    app.wait_for_selector("[data-testid='candidature-card']")

    expect(cartes).to_have_count(NB_PISTES_INITIALES + 1)
    expect(app.get_by_role("heading", name="Persistance SA")).to_be_visible()


# --------------------------------------------------------------------------
# Statistiques et export
# --------------------------------------------------------------------------


def test_ct_sc13_vue_statistiques(app):
    """CT-SC13 — La vue statistiques calcule le taux de réponse attendu."""
    app.get_by_label("Statistiques").click()

    expect(app.get_by_text("Taux de réponse")).to_be_visible()
    # 1 refus + 1 vivier sur 4 pistes = 50 %
    expect(app.get_by_text("50%", exact=True)).to_be_visible()
    expect(app.get_by_test_id("candidature-card")).to_have_count(0)


def test_ct_sc14_export_csv(app):
    """CT-SC14 — L'export déclenche le téléchargement d'un CSV non vide."""
    with app.expect_download() as telechargement:
        app.get_by_label("Exporter en CSV").click()

    fichier = telechargement.value
    assert fichier.suggested_filename == "candidatures.csv"

    chemin = fichier.path()
    contenu = chemin.read_text(encoding="utf-8-sig")
    assert "Entreprise" in contenu
    assert "Entreprise Exemple SA" in contenu


# --------------------------------------------------------------------------
# Résilience réseau
# --------------------------------------------------------------------------


def test_ct_sc15_saisie_hors_ligne(app, cartes):
    """CT-SC15 — Une saisie effectuée hors ligne est conservée et survit au retour du réseau.

    Scénario inspiré d'une contrainte de terrain réelle : en zone blanche, une
    application qui perd la connexion ne doit ni perdre la donnée saisie, ni la
    réémettre avec un horodatage faussé. L'application stockant ses données
    côté client, elle doit rester pleinement utilisable sans réseau.
    """
    app.context.set_offline(True)

    app.get_by_label("Ajouter une candidature").click()
    formulaire = app.get_by_test_id("add-form")
    formulaire.get_by_label("Entreprise *").fill("Saisie hors ligne")
    formulaire.get_by_role("button", name="Ajouter").click()

    # La saisie est prise en compte sans aucun appel réseau.
    expect(cartes).to_have_count(NB_PISTES_INITIALES + 1)
    expect(cartes.first).to_contain_text("Saisie hors ligne")
    expect(app.get_by_text("Sauvegarde impossible")).to_have_count(0)

    # Retour du réseau : la donnée saisie hors ligne doit avoir été conservée.
    app.context.set_offline(False)
    app.reload()
    app.wait_for_selector("[data-testid='candidature-card']")

    expect(cartes).to_have_count(NB_PISTES_INITIALES + 1)
    expect(app.get_by_role("heading", name="Saisie hors ligne")).to_be_visible()

