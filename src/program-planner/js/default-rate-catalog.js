(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};

  function rateKind(category, description) {
    var source = String(category || "") + " " + String(description || "");
    if (/sundry|misc|fee|admin|permit|traffic/i.test(source)) return "Sundry";
    if (/labou?r|crew|staff|worker|supervisor|operator|hours/i.test(source)) return "Labour";
    if (/contractor|subcontractor|plant hire|equipment hire|excavator|machinery|truck|tipper|bobcat/i.test(category || "")) return "Contractors";
    if (/materials?|soil|turf|mulch|plant|tree|shrub|seed|lawn|top[ -]?dress|fertili[sz]|aggregate|gravel|sand|compost|irrigation|timber|pipe|hardware|supply/i.test(category || "")) return "Material";
    return "Equipment";
  }

  function rate(id, active, category, description, unit, unitRate, sourceId) {
    var provenance = {
      owner: "GLOBAL",
      sourceApp: sourceId ? "uos.remediation" : "",
      sourceVersion: sourceId ? 2 : null,
      sourceId: sourceId || "",
      importedAt: ""
    };
    if (sourceId) {
      provenance.legacyId = sourceId;
      provenance.ownerName = "remediation";
    }
    return {
      id: id,
      owner: "",
      type: "rateItem",
      active: active,
      status: active ? "Active" : "Inactive",
      kind: rateKind(category, description),
      category: category,
      description: description,
      title: description,
      unit: unit,
      unitRate: unitRate,
      quantityKind: ["m²", "m2", "sqm", "ha", "hectare", "hectares", "km²", "km2"].indexOf(String(unit || "").toLowerCase()) >= 0 ? "area" : "direct",
      provenance: provenance
    };
  }

  var items = [
    rate("RATE-03Q5IYW", true, "City Operations", "Horticulture Labour rate - Monday to Friday 6am - 6pm", "item", 80, "quote-catalogue-c6a1e9d2"),
    rate("RATE-0792XC3", true, "Sundry Costs", "Starter fertiliser", "item", 25, "quote-catalogue-e1cbae3f"),
    rate("RATE-08NOY3P", true, "Turf Remediation", "Fertilising supply and spreading", "item", 789.91, "quote-catalogue-c6a30423"),
    rate("RATE-08WUH60", false, "Turf Remediation", "Aeration, Verti-drain at 100mm", "item", 819.72, "quote-catalogue-445f4959"),
    rate("RATE-09OCIAW", true, "Sundry Costs", "Softfall woodchips (truck/trailer)", "item", 40, "quote-catalogue-47d73780"),
    rate("RATE-0D2ZK7E", true, "Irrigation", "Lateral Line", "item", 180, "quote-catalogue-5a0f9240"),
    rate("RATE-0DAABEF", false, "Turf Remediation", "Broadleaf spraying (inc chemical)", "item", 210, "quote-catalogue-df984701"),
    rate("RATE-0DLVIOB", true, "Turf Remediation", "Rolling turf", "item", 501.6, "quote-catalogue-d6a06f99"),
    rate("RATE-0EWX5ZT", true, "Irrigation", "Sprinkler", "item", 220.77, "quote-catalogue-5512019a"),
    rate("RATE-0FTBD6P", true, "City Operations", "Horticulture Labour rate - Monday to Friday 6pm - 6am", "item", 141, "quote-catalogue-d694e23f"),
    rate("RATE-0GHHJTP", true, "Turf Remediation", "Aeration/Rolling", "item", 789.91, "quote-catalogue-1ba3b8f6"),
    rate("RATE-0HQKYAS", true, "Soil / top dress", "Organic (Special)", "item", 0, "quote-catalogue-fa99cd68"),
    rate("RATE-0K0L5G0", true, "Irrigation", "Irrigation box lid replacement", "item", 51.35, "quote-catalogue-8b2b68d0"),
    rate("RATE-0KQHDAL", true, "Turf Remediation", "Direct Seeding", "item", 0.6, "quote-catalogue-9e1a3d96"),
    rate("RATE-0MFO5YT", true, "Irrigation", "Solenoid valve & box replacement", "item", 551.82, "quote-catalogue-4ee0ddb7"),
    rate("RATE-0OE3MTC", true, "Irrigation", "Valve in head sprinkler (Elder/Vic Sq/Rymill Park)", "item", 569.98, "quote-catalogue-91ae3144"),
    rate("RATE-0V9N628", true, "Turf Remediation", "Broadacre mowing", "item", 275.64, "quote-catalogue-d693cbd0"),
    rate("RATE-0ZF0VYU", false, "Turf Remediation", "WZTM delivery per 1000m2", "item", 649, "quote-catalogue-9f58b278"),
    rate("RATE-13HF5EH", true, "Plant Hire/Contractors (external)", "Roller", "item", 1, "quote-catalogue-ab62a005"),
    rate("RATE-1C7Q6H6", true, "Sundry Costs", "Fertilising", "item", 0, "quote-catalogue-b17eb9b1"),
    rate("RATE-1CT00CK", true, "Irrigation", "Backhoe plant cost", "item", 21, "quote-catalogue-0a5e8288"),
    rate("RATE-1DGXS4B", true, "Turf Remediation", "Instant Turf Small Sods - Prep, supply & install, soil removal to CoA location, top dress gaps/blending & WZTM", "item", 16.6, "quote-catalogue-f559b993"),
    rate("RATE-1F7NCZY", true, "Turf Remediation", "Hydro-seeding", "item", 1.37, "quote-catalogue-85fa8789"),
    rate("RATE-1GC1SMT", true, "Sundry Costs", "Water Crystals", "item", 20, "quote-catalogue-216930ce"),
    rate("RATE-1HEXPQP", true, "Irrigation", "Standard box replacement", "item", 132.43, "quote-catalogue-b93e4ee5"),
    rate("RATE-1HLJI7U", true, "Turf Remediation", "Top dressing", "item", 62, "quote-catalogue-d7bd6b67"),
    rate("RATE-1N9GYEZ", true, "Plants", "Plants total", "item", 15, "quote-catalogue-fdd4c0d0"),
    rate("RATE-1QWHUJO", true, "Turf Remediation", "Instant Turf Maxi Roll - Prep, supply & install, soil removal to CoA location, top dress gaps/blending & WZTM", "item", 15.94, "quote-catalogue-060af184"),
    rate("RATE-1S3WIWW", true, "Turf Remediation", "Aeravator", "item", 859.89, "quote-catalogue-e67f1b31"),
    rate("RATE-1SML561", true, "Soil / top dress", "Spreading", "item", 15, "quote-catalogue-147e5527"),
    rate("RATE-1UDBSI2", true, "Sundry Costs", "Softfall woodchips (tandem only)", "item", 36, "quote-catalogue-e8ffdde9"),
    rate("RATE-1VO26KD", true, "Plant Hire/Contractors (external)", "Truck & excavator", "item", 1300, "quote-catalogue-7e7526e4"),
    rate("RATE-1WP8WOC", true, "City Operations", "Horticulture Labour rate - Saturday, Sunday & Public Holidays", "item", 141, "quote-catalogue-5dbd8671"),
    rate("RATE-1WTO831", true, "Irrigation", "Main line repair - Parts only", "item", 500, "quote-catalogue-3c44098d"),
    rate("RATE-1XPNCXF", true, "Soil / top dress", "80/20 organic", "item", 0, "quote-catalogue-1f8ff956"),
    rate("RATE-1Y14KSX", true, "Soil / top dress", "LDS(top-dress)", "item", 0, "quote-catalogue-3e643cc3"),
    rate("RATE-1YHUNOD", true, "Irrigation", "Key - valve in head sprinkler", "item", 26.69, "quote-catalogue-830a1111"),
    rate("RATE-AERATION", true, "Groundworks & Turf", "Aeration", "m²", 18, ""),
    rate("RATE-IRRIGATION-SYSTEM", true, "Infrastructure", "Irrigation System", "m²", 65, ""),
    rate("RATE-MULCHING-SOIL-PREP", true, "Groundworks & Turf", "Mulching & Soil Prep", "m²", 28, ""),
    rate("RATE-NATIVE-GARDEN-BED", true, "Planting & Vegetation", "Native Garden Bed", "m²", 45, ""),
    rate("RATE-PERMEABLE-PAVING", true, "Infrastructure", "Permeable Paving", "m²", 110, ""),
    rate("RATE-TREE-PLANTING", true, "Planting & Vegetation", "Tree Planting", "m²", 120, ""),
    rate("RATE-TURF-RENOVATION", true, "Groundworks & Turf", "Turf Renovation", "m²", 35, ""),
    rate("RATE-TURFING", true, "Groundworks & Turf", "Turfing", "m²", 45, "")
  ];

  UOS.ProgramDefaultRateCatalog = Object.freeze({
    version: 1,
    source: "horticulture-program-workspace-20260820-v2-repaired",
    items: function () { return JSON.parse(JSON.stringify(items)); }
  });
}());
