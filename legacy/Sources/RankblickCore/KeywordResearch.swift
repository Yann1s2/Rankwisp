import Foundation

public struct KeywordResearchPlan: Codable {
    public let appleID: Int
    public let country: String
    public let keywords: [ResearchKeyword]
}
public struct ResearchKeyword: Codable {
    public let text: String
    public let category: KeywordCategory
    public let rationale: String
}
public extension Repository {
    func importResearch(_ plan: KeywordResearchPlan) throws {
        guard !plan.keywords.isEmpty, plan.keywords.allSatisfy({ normalizedKeywords($0.text) == [$0.text] && $0.text.count <= 100 }) else {
            throw RankblickError.message("Ungültige Keyword-Recherche.")
        }
        try update { data in
            guard let p = data.projects.firstIndex(where: { $0.appleID == plan.appleID && $0.country == plan.country.lowercased() && !$0.archived }) else { throw RankblickError.message("Projekt nicht gefunden.") }
            for entry in plan.keywords {
                if let k = data.projects[p].keywords.firstIndex(where: { $0.text == entry.text }) {
                    data.projects[p].keywords[k].category = entry.category
                    data.projects[p].keywords[k].researchNote = entry.rationale
                } else {
                    var keyword = Keyword(text: entry.text)
                    keyword.category = entry.category; keyword.researchNote = entry.rationale
                    data.projects[p].keywords.append(keyword)
                }
            }
            guard data.projects[p].activeKeywords.count <= 100 else { throw RankblickError.message("Maximal 100 aktive Keywords.") }
        }
    }
}
