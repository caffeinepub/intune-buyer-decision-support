import Array "mo:base/Array";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Option "mo:base/Option";
import Text "mo:base/Text";
import TrieMap "mo:base/TrieMap";

actor {

  // ---- Types ----

  type StyleRecord = {
    styleCode: Text;
    styleName: Text;
    category: Text;
    season: Text;
    vendorLeadTimeDays: Nat;
    grossMarginPct: Float;
  };

  type SalesRecord = {
    styleCode: Text;
    season: Text;
    weekNumber: Nat;
    weeklySalesUnits: Nat;
    weeklySalesValue: Float;
  };

  type InventoryRecord = {
    styleCode: Text;
    season: Text;
    currentStock: Nat;
    reorderPoint: Nat;
  };

  type SizeRecord = {
    styleCode: Text;
    season: Text;
    size: Text;
    sizeContributionPct: Float;
    currentSizeStock: Nat;
  };

  type KPIResult = {
    styleCode: Text;
    styleName: Text;
    season: Text;
    ros: Float;
    inventoryCoverWeeks: Float;
    grossMarginPct: Float;
    buyingScore: Float;
    classification: Text;
  };

  type SupplyChainResult = {
    styleCode: Text;
    season: Text;
    vendorLeadTimeDays: Nat;
    seasonRunwayWeeks: Float;
    salesStabilityScore: Float;
    velocityProfile: Text;
    decision: Text;
  };

  type SizeAllocationResult = {
    styleCode: Text;
    season: Text;
    size: Text;
    ratioPart: Float;
    sizeContributionPct: Float;
    suggestedRebuyQty: Nat;
  };

  type DashboardSummary = {
    totalStyles: Nat;
    rebuyCount: Nat;
    monitorCount: Nat;
    doNotRebuyCount: Nat;
    topCandidates: [KPIResult];
  };

  // ---- Storage ----

  stable var stylesArr: [StyleRecord] = [];
  stable var salesArr: [SalesRecord] = [];
  stable var inventoryArr: [InventoryRecord] = [];
  stable var sizeArr: [SizeRecord] = [];

  // ---- Upload ----

  public func uploadStyles(records: [StyleRecord]) : async () {
    stylesArr := records;
  };

  public func uploadSales(records: [SalesRecord]) : async () {
    salesArr := records;
  };

  public func uploadInventory(records: [InventoryRecord]) : async () {
    inventoryArr := records;
  };

  public func uploadSizes(records: [SizeRecord]) : async () {
    sizeArr := records;
  };

  public func clearAllData() : async () {
    stylesArr := [];
    salesArr := [];
    inventoryArr := [];
    sizeArr := [];
  };

  // ---- Query: lists ----

  public query func getSeasons() : async [Text] {
    var seen = TrieMap.TrieMap<Text, Bool>(Text.equal, Text.hash);
    for (s in stylesArr.vals()) { seen.put(s.season, true); };
    Iter.toArray(seen.keys())
  };

  public query func getCategories() : async [Text] {
    var seen = TrieMap.TrieMap<Text, Bool>(Text.equal, Text.hash);
    for (s in stylesArr.vals()) { seen.put(s.category, true); };
    Iter.toArray(seen.keys())
  };

  public query func getStyles(season: ?Text, category: ?Text) : async [StyleRecord] {
    Array.filter(stylesArr, func(s: StyleRecord) : Bool {
      let seasonOk = switch (season) { case null true; case (?v) s.season == v; };
      let catOk = switch (category) { case null true; case (?v) s.category == v; };
      seasonOk and catOk
    })
  };

  // ---- KPI computation ----

  public query func getKPIs(season: ?Text, category: ?Text) : async [KPIResult] {
    let filtered = Array.filter(stylesArr, func(s: StyleRecord) : Bool {
      let seasonOk = switch (season) { case null true; case (?v) s.season == v; };
      let catOk = switch (category) { case null true; case (?v) s.category == v; };
      seasonOk and catOk
    });

    Array.map(filtered, func(style: StyleRecord) : KPIResult {
      // compute ROS
      let styleSales = Array.filter(salesArr, func(r: SalesRecord) : Bool {
        r.styleCode == style.styleCode and (switch (season) { case null true; case (?v) r.season == v; })
      });
      let totalUnits = Array.foldLeft(styleSales, 0, func(acc: Nat, r: SalesRecord) : Nat { acc + r.weeklySalesUnits });
      let weekCount = styleSales.size();
      let ros: Float = if (weekCount == 0) 0.0 else Float.fromInt(totalUnits) / Float.fromInt(weekCount);

      // inventory cover
      let invRec = Array.find(inventoryArr, func(r: InventoryRecord) : Bool {
        r.styleCode == style.styleCode and (switch (season) { case null true; case (?v) r.season == v; })
      });
      let stock: Float = switch (invRec) { case null 0.0; case (?r) Float.fromInt(r.currentStock); };
      let invCover: Float = if (ros <= 0.0) 0.0 else stock / ros;

      // buying score: composite
      let gmScore = style.grossMarginPct / 100.0 * 30.0;
      let rosScore = Float.min(ros / 50.0 * 40.0, 40.0);
      let coverScore: Float = if (invCover < 2.0) 30.0 else if (invCover < 4.0) 20.0 else if (invCover < 8.0) 10.0 else 0.0;
      let buyingScore = gmScore + rosScore + coverScore;

      let classification = if (buyingScore >= 60.0) "Re-buy Candidate"
        else if (buyingScore >= 35.0) "Monitor"
        else "Do Not Re-buy";

      {
        styleCode = style.styleCode;
        styleName = style.styleName;
        season = style.season;
        ros = ros;
        inventoryCoverWeeks = invCover;
        grossMarginPct = style.grossMarginPct;
        buyingScore = buyingScore;
        classification = classification;
      }
    })
  };

  // ---- Supply chain metrics ----

  public query func getSupplyChainMetrics(styleCode: Text, season: Text) : async ?SupplyChainResult {
    let styleOpt = Array.find(stylesArr, func(s: StyleRecord) : Bool { s.styleCode == styleCode and s.season == season });
    switch (styleOpt) {
      case null null;
      case (?style) {
        let styleSales = Array.filter(salesArr, func(r: SalesRecord) : Bool { r.styleCode == styleCode and r.season == season });
        let weekCount = styleSales.size();

        // season runway: assume 26 weeks per season, use latest week
        let maxWeek = Array.foldLeft(styleSales, 0, func(acc: Nat, r: SalesRecord) : Nat { if (r.weekNumber > acc) r.weekNumber else acc });
        let seasonRunway: Float = Float.fromInt(if (26 > maxWeek) 26 - maxWeek else 0);

        // sales stability: stddev-based
        let totalUnits = Array.foldLeft(styleSales, 0, func(acc: Nat, r: SalesRecord) : Nat { acc + r.weeklySalesUnits });
        let avgSales: Float = if (weekCount == 0) 0.0 else Float.fromInt(totalUnits) / Float.fromInt(weekCount);
        let variance = Array.foldLeft(styleSales, 0.0, func(acc: Float, r: SalesRecord) : Float {
          let diff = Float.fromInt(r.weeklySalesUnits) - avgSales;
          acc + diff * diff
        });
        let stddev = if (weekCount == 0) 0.0 else Float.sqrt(variance / Float.fromInt(weekCount));
        let cv = if (avgSales <= 0.0) 1.0 else stddev / avgSales;
        let stabilityScore = Float.max(0.0, 100.0 - cv * 100.0);

        // velocity profile
        let velocity = if (weekCount < 2) "Stable"
          else {
            let firstHalf = Array.filter(styleSales, func(r: SalesRecord) : Bool { r.weekNumber <= maxWeek / 2 });
            let secondHalf = Array.filter(styleSales, func(r: SalesRecord) : Bool { r.weekNumber > maxWeek / 2 });
            let avgFirst = if (firstHalf.size() == 0) 0.0 else Float.fromInt(Array.foldLeft(firstHalf, 0, func(a: Nat, r: SalesRecord) : Nat { a + r.weeklySalesUnits })) / Float.fromInt(firstHalf.size());
            let avgSecond = if (secondHalf.size() == 0) 0.0 else Float.fromInt(Array.foldLeft(secondHalf, 0, func(a: Nat, r: SalesRecord) : Nat { a + r.weeklySalesUnits })) / Float.fromInt(secondHalf.size());
            if (avgSecond > avgFirst * 1.1) "Rising"
            else if (avgSecond < avgFirst * 0.9) "Declining"
            else "Stable"
          };

        // final decision
        let leadTimeWeeks = Float.fromInt(style.vendorLeadTimeDays) / 7.0;
        let decision = if (seasonRunway > leadTimeWeeks + 2.0 and stabilityScore >= 50.0 and velocity != "Declining")
            "Immediate Re-buy Required"
          else if (stabilityScore >= 30.0 and seasonRunway > leadTimeWeeks)
            "Monitor Performance"
          else
            "Do Not Re-buy";

        ?{
          styleCode = styleCode;
          season = season;
          vendorLeadTimeDays = style.vendorLeadTimeDays;
          seasonRunwayWeeks = seasonRunway;
          salesStabilityScore = stabilityScore;
          velocityProfile = velocity;
          decision = decision;
        }
      };
    }
  };

  // ---- Size allocation ----

  public query func getSizeAllocation(styleCode: Text, season: Text, totalRebuyQty: Nat) : async [SizeAllocationResult] {
    let sizes = Array.filter(sizeArr, func(r: SizeRecord) : Bool { r.styleCode == styleCode and r.season == season });
    Array.map(sizes, func(r: SizeRecord) : SizeAllocationResult {
      let suggestedQty = Int.abs(Float.toInt(r.sizeContributionPct / 100.0 * Float.fromInt(totalRebuyQty)));
      {
        styleCode = r.styleCode;
        season = r.season;
        size = r.size;
        ratioPart = r.sizeContributionPct;
        sizeContributionPct = r.sizeContributionPct;
        suggestedRebuyQty = suggestedQty;
      }
    })
  };

  // ---- Dashboard summary ----

  public query func getDashboardSummary(season: ?Text) : async DashboardSummary {
    let filtered = Array.filter(stylesArr, func(s: StyleRecord) : Bool {
      switch (season) { case null true; case (?v) s.season == v; }
    });

    var rebuy = 0; var monitor = 0; var doNotRebuy = 0;
    var candidates: [KPIResult] = [];

    for (style in filtered.vals()) {
      let styleSales = Array.filter(salesArr, func(r: SalesRecord) : Bool {
        r.styleCode == style.styleCode and (switch (season) { case null true; case (?v) r.season == v; })
      });
      let totalUnits = Array.foldLeft(styleSales, 0, func(acc: Nat, r: SalesRecord) : Nat { acc + r.weeklySalesUnits });
      let weekCount = styleSales.size();
      let ros: Float = if (weekCount == 0) 0.0 else Float.fromInt(totalUnits) / Float.fromInt(weekCount);
      let invRec = Array.find(inventoryArr, func(r: InventoryRecord) : Bool {
        r.styleCode == style.styleCode and (switch (season) { case null true; case (?v) r.season == v; })
      });
      let stock: Float = switch (invRec) { case null 0.0; case (?r) Float.fromInt(r.currentStock); };
      let invCover: Float = if (ros <= 0.0) 0.0 else stock / ros;
      let gmScore = style.grossMarginPct / 100.0 * 30.0;
      let rosScore = Float.min(ros / 50.0 * 40.0, 40.0);
      let coverScore: Float = if (invCover < 2.0) 30.0 else if (invCover < 4.0) 20.0 else if (invCover < 8.0) 10.0 else 0.0;
      let buyingScore = gmScore + rosScore + coverScore;
      let classification = if (buyingScore >= 60.0) "Re-buy Candidate"
        else if (buyingScore >= 35.0) "Monitor"
        else "Do Not Re-buy";

      if (classification == "Re-buy Candidate") { rebuy += 1; }
      else if (classification == "Monitor") { monitor += 1; }
      else { doNotRebuy += 1; };

      if (classification == "Re-buy Candidate") {
        candidates := Array.append(candidates, [{
          styleCode = style.styleCode;
          styleName = style.styleName;
          season = style.season;
          ros = ros;
          inventoryCoverWeeks = invCover;
          grossMarginPct = style.grossMarginPct;
          buyingScore = buyingScore;
          classification = classification;
        }]);
      };
    };

    // top 5
    let top5 = if (candidates.size() <= 5) candidates
      else Array.tabulate(5, func(i: Nat) : KPIResult { candidates[i] });

    {
      totalStyles = filtered.size();
      rebuyCount = rebuy;
      monitorCount = monitor;
      doNotRebuyCount = doNotRebuy;
      topCandidates = top5;
    }
  };

}
