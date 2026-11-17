import SwiftUI
import RankblickCore

struct AddKeywordsView: View {
    let model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Keywords beobachten").font(Theme.font(25, .semibold))
            Text("Für \(model.project?.name ?? "deine App") · \(model.project?.country.uppercased() ?? "")\nEin Begriff pro Zeile oder durch Kommas getrennt.").foregroundStyle(Theme.secondary)
            TextEditor(text: $text).font(Theme.font(13)).scrollContentBackground(.hidden).frame(height: 150).padding(8).background(Theme.muted.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
            Text("Doppelte Begriffe werden übersprungen. Archivierte Keywords werden mit ihrem Verlauf wiederhergestellt.").font(Theme.font(11)).foregroundStyle(Theme.secondary)
            if let error { Text(error).foregroundStyle(Theme.crimson) }
            HStack { Button("Abbrechen") { dismiss() }; Spacer(); Button("Hinzufügen & messen") {
                do { try model.addKeywords(text); dismiss() } catch { self.error = error.localizedDescription }
            }.buttonStyle(PillStyle(dark: true)).disabled(normalizedKeywords(text).isEmpty).keyboardShortcut(.defaultAction) }
        }.padding(28).frame(width: 480).preferredColorScheme(.light).foregroundStyle(Theme.ink).font(Theme.font(12)).tint(Theme.crimson).background(Theme.paper)
    }
}

struct AddAppView: View {
    let model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var country = "ch"
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Eine App hinzufügen").font(Theme.font(25, .semibold))
            Text("Füge die App-Store-URL oder App-ID einer iPhone-App ein.").foregroundStyle(Theme.secondary)
            TextField("https://apps.apple.com/…/id123456789", text: $input).textFieldStyle(.plain).padding(12).background(Theme.muted.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
            Picker("App Store", selection: $country) {
                Text("Schweiz").tag("ch"); Text("Deutschland").tag("de"); Text("Österreich").tag("at")
                Text("USA").tag("us"); Text("Grossbritannien").tag("gb"); Text("Frankreich").tag("fr"); Text("Italien").tag("it")
            }
            Text("Jeder Store erhält einen eigenen Verlauf. Deine App-ID und Suchbegriffe werden direkt an Apple gesendet.").font(Theme.font(11)).foregroundStyle(Theme.secondary)
            if let error { Text(error).foregroundStyle(Theme.crimson) }
            HStack { Button("Abbrechen") { dismiss() }.disabled(busy); Spacer(); if busy { ProgressView().controlSize(.small) }; Button("App hinzufügen") {
                busy = true
                Task {
                    do { try await model.addProject(input: input, country: country); dismiss() }
                    catch { self.error = error.localizedDescription }
                    busy = false
                }
            }.buttonStyle(PillStyle(dark: true)).disabled(busy || input.isEmpty).keyboardShortcut(.defaultAction) }
        }.padding(28).frame(width: 480).preferredColorScheme(.light).foregroundStyle(Theme.ink).font(Theme.font(12)).tint(Theme.crimson).background(Theme.paper)
    }
}

struct SettingsView: View {
    @Bindable var model: AppModel
    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text("Dein täglicher Blick auf die Suche").font(Theme.font(23, .semibold))
            Toggle("Automatisch mindestens einmal täglich messen", isOn: Binding(get: { model.workspace.automaticUpdates }, set: { model.setAutomatic($0) }))
                .toggleStyle(.switch)
            Text(model.agentInstalled ? "Der Hintergrundjob ist eingerichtet. Er prüft alle fünf Minuten, welche Keywords fällig sind – auch wenn Rankblick geschlossen ist." : "Der Hintergrundjob ist noch nicht eingerichtet. Bei geöffnetem Fenster prüft Rankblick selbst auf fällige Messungen.")
                .foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            if !model.agentInstalled { Button("Hintergrundjob einrichten") { model.setAutomatic(true) } }
            Text("Der Mac muss eingeschaltet, angemeldet und online sein. Nach Schlaf oder Ausschalten wird beim nächsten möglichen Lauf nachgeholt. Fehlende Tage werden nicht erfunden.")
                .font(Theme.font(11)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            if let checked = model.workspace.lastBackgroundCheck { Text("Letzte Hintergrundprüfung: \(checked.formatted(date: .abbreviated, time: .shortened))").font(Theme.font(11)) }
            Divider()
            Text("Deine Daten bleiben auf deinem Mac").font(Theme.font(15, .semibold))
            Text("Keywords und Suchanfragen gehen nur an Apple. Kein Konto, kein Astro-Zugang und keine Telemetrie. Jeder erfolgreiche Abruf bleibt im Verlauf; Fehler überschreiben keine Positionen.").font(Theme.font(12)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            HStack {
                Button("Datenordner öffnen") { if let url = model.repository?.directory { NSWorkspace.shared.open(url) } }
                Button("Vollständiges Backup exportieren …") { model.export() }
            }
            Text("Automatischer Analyse-Export").font(Theme.font(15, .semibold))
            Text(model.analysisExportDate.map { "Aktualisiert: \($0.formatted(date: .abbreviated, time: .shortened)) · JSON & Text bei jeder gespeicherten Änderung. Mit Rankings, Konkurrenz, App-Profilen und vollständigem Verlauf." } ?? "Wird beim nächsten Speichern erstellt.").font(Theme.font(11)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            if let error = model.exportError { Text(error).font(Theme.font(11)).foregroundStyle(Theme.crimson).fixedSize(horizontal: false, vertical: true) }
            Button("Analyse-Dateien anzeigen") { model.openAnalysisExport() }
            Text("Rankblick 1.5 · Entwickelt für Yannis\nAPI-Positionen sind keine garantierten iPhone-Suchergebnisse. Popularity und Difficulty werden nicht geschätzt.").font(Theme.font(11)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            Link("Dokumentation der Apple-Such-API", destination: URL(string: "https://performance-partners.apple.com/search-api")!)
        }.preferredColorScheme(.light).foregroundStyle(Theme.ink).font(Theme.font(12)).tint(Theme.crimson).background(Theme.paper)
    }
}
