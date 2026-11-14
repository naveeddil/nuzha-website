// Complete import from _images/CDR Menu/Nuzha Menu 2025.cdr (2026-11-13).
// Flags are shown publicly so missing photos/prices and source inconsistencies are not lost.
const NUZHA_MENU_META={
  bbq:{descEn:"Seasoned and grilled over charcoal in the Nuzha style.",descAr:"متبل ومشوي على الفحم على طريقة النزهة.",image:"gallery-images/bbq--mixed-kebabs.jpg"},
  breakfast:{descEn:"Freshly prepared for a warm, traditional breakfast.",descAr:"يحضر طازجاً لفطور تقليدي شهي.",image:"gallery-images/kitchen--ready-to-serve.jpg"},
  rice:{descEn:"Served with fragrant rice and Nuzha house seasoning.",descAr:"يقدم مع الأرز العطري وبهارات النزهة.",image:"assets/rice-clean.jpg"},
  fried:{descEn:"Fried until golden and crisp, then served fresh.",descAr:"يقلى حتى يصبح ذهبياً ومقرمشاً ويقدم طازجاً.",image:"gallery-images/dishes--fried-fish.png"},
  appetizers:{descEn:"A fresh house appetizer, prepared to order.",descAr:"مقبل طازج من إعداد المطعم يحضر عند الطلب.",image:"gallery-images/salads--mezze-platter.jpg"},
  curries:{descEn:"Slow-cooked with a balanced blend of aromatic spices.",descAr:"مطهو على مهل بمزيج متوازن من البهارات العطرية.",image:"gallery-images/kitchen--ready-to-serve.jpg"}
};
function nuzhaItem(category,nameEn,nameAr,price,options={}){const meta=NUZHA_MENU_META[category];return {category,nameEn,nameAr,descEn:options.descEn||meta.descEn,descAr:options.descAr||meta.descAr,price,image:options.image||meta.image,missingImage:options.missingImage??true,priceMissing:price==="—",needsReview:!!options.reviewEn,reviewEn:options.reviewEn||"",reviewAr:options.reviewAr||""}}
window.NUZHA_MENU = [
  // Barbecue grills / مشويات نزهة
  nuzhaItem("bbq","Beef barbecue","أوصال لحم","35",{reviewEn:"Arabic panel shows SAR 25; confirm the price.",reviewAr:"السعر في الجانب العربي ٢٥ ر.س؛ يرجى التأكيد."}),
  nuzhaItem("bbq","Lamb ribs","ريش","35",{reviewEn:"Arabic panel shows SAR 25; confirm the price.",reviewAr:"السعر في الجانب العربي ٢٥ ر.س؛ يرجى التأكيد."}),
  nuzhaItem("bbq","Chicken kebab","كباب دجاج","30"),
  nuzhaItem("bbq","Barbecue quail","سمان طيور","30",{image:"assets/grill.jpg"}),
  nuzhaItem("bbq","Half charcoal chicken with bread","نصف دجاج فحم مع خبز","16",{image:"assets/grill.jpg"}),
  nuzhaItem("bbq","Meat kebab (kofta)","كباب لحم","35"),
  nuzhaItem("bbq","Grilled chicken","حبة دجاج شواية سادة","30",{image:"assets/grill.jpg",missingImage:false,reviewEn:"Arabic panel appears to show SAR 35; confirm the price.",reviewAr:"يبدو أن السعر في الجانب العربي ٣٥ ر.س؛ يرجى التأكيد."}),
  nuzhaItem("bbq","Chicken pieces with fries and salad","شيش طاووق","30",{image:"assets/grill.jpg",reviewEn:"Arabic and English item wording differ; confirm the Arabic name.",reviewAr:"اسم الصنف مختلف بين النسختين؛ يرجى تأكيد الاسم العربي."}),
  nuzhaItem("bbq","Mixed BBQ plate","مشكل مشوي","35",{missingImage:false,reviewEn:"Arabic layout associates a different size/price; confirm this item.",reviewAr:"تنسيق الجانب العربي يربط الصنف بحجم وسعر مختلفين؛ يرجى التأكيد."}),
  nuzhaItem("bbq","Mixed barbecue — half kilogram","مشكل مشوي نصف كيلو","80",{missingImage:false}),
  nuzhaItem("bbq","Mixed barbecue — one kilogram","مشكل مشوي واحد كيلو","160",{missingImage:false}),

  // Nuzha breakfast / وجبات فطور نزهة
  nuzhaItem("breakfast","Hummus","حمص","7",{image:"gallery-images/salads--mezze-platter.jpg"}),
  nuzhaItem("breakfast","Liver with tomato","كبدة بالطماطم","10"),
  nuzhaItem("breakfast","Liver with kidney","مشكل كبدة مع كلاوي","12"),
  nuzhaItem("breakfast","Mutton kidneys","كلاوي","12"),
  nuzhaItem("breakfast","Meat with tomato","لحم بالطماطم","12"),
  nuzhaItem("breakfast","Full fried eggs","بيض عيون كامل","7",{image:"assets/logo.png"}),
  nuzhaItem("breakfast","Half-fried eggs","بيض عيون نصف استواء","7",{image:"assets/logo.png"}),
  nuzhaItem("breakfast","Lentil soup","شوربة عدس","7"),
  nuzhaItem("breakfast","Foul","فول","7",{image:"assets/logo.png"}),
  nuzhaItem("breakfast","Egg omelet","شكشوكة","7",{image:"assets/logo.png",reviewEn:"English says omelet while Arabic says shakshuka; confirm the preferred name.",reviewAr:"الإنجليزية تذكر عجة بينما العربية تذكر شكشوكة؛ يرجى التأكيد."}),

  // Rice items / كبسات وأرز
  nuzhaItem("rice","Mandi chicken rice — quarter","ربع مندي","12"),
  nuzhaItem("rice","Mandi chicken rice — half","نصف مندي","21"),
  nuzhaItem("rice","Mandi chicken rice — whole","حبة دجاج مندي","42"),
  nuzhaItem("rice","Fresh mandi meat with rice — single","نفر لحم مندي بلدي","80"),
  nuzhaItem("rice","Grilled chicken rice — quarter","ربع شواية","12"),
  nuzhaItem("rice","Grilled chicken rice — half","نصف شواية","21"),
  nuzhaItem("rice","Grilled chicken rice — whole","حبة دجاج شواية","42"),
  nuzhaItem("rice","Grilled chicken","لحم حاشي","30",{image:"assets/grill.jpg",reviewEn:"Arabic panel appears to say camel meat at SAR 50; confirm this item.",reviewAr:"يبدو أن الجانب العربي يذكر لحم حاشي بسعر ٥٠ ر.س؛ يرجى التأكيد."}),
  nuzhaItem("rice","Plain rice","أرز سادة","7"),
  nuzhaItem("rice","BBQ chicken rice — half","نصف فحم","22"),
  nuzhaItem("rice","BBQ chicken rice — whole","حبة دجاج فحم مع الأرز","44"),
  nuzhaItem("rice","Imported meat with rice","كبسة لحم مستورد","30"),
  nuzhaItem("rice","Mandi rice","رز مندي","7"),
  nuzhaItem("rice","Biryani rice","رز برياني","7"),
  nuzhaItem("rice","Bukhari rice","رز بخاري","7"),
  nuzhaItem("rice","White rice","رز أبيض","7"),

  // Fried and fish / بروستد وأسماك
  nuzhaItem("fried","Fried fish","سمك مقلي حسب الحجم","—",{missingImage:false,descEn:"Whole fish fried until crisp; the CDR prices it according to weight.",descAr:"سمك كامل مقلي ومقرمش؛ السعر حسب الوزن."}),
  nuzhaItem("fried","Broasted chicken with fries","بروستد كندادي","19",{image:"assets/grill.jpg"}),
  nuzhaItem("fried","French fries","بطاطس مقلي","6",{image:"assets/logo.png"}),

  // Appetizers / مقبلات نزهة
  nuzhaItem("appetizers","Mixed appetizers","مقبلات","12",{missingImage:false}),
  nuzhaItem("appetizers","Green salad","سلطة خضرة","6",{image:"gallery-images/salads--fattoush.jpg"}),
  nuzhaItem("appetizers","Grape-leaf salad","ورق عنب","7"),
  nuzhaItem("appetizers","Tabbouleh salad","تبولة","6",{image:"gallery-images/salads--tabbouleh.jpg",missingImage:false}),
  nuzhaItem("appetizers","Hummus","حمص","7"),
  nuzhaItem("appetizers","Mutabbal","متبل","7"),
  nuzhaItem("appetizers","Cucumber and mint yogurt","خيار باللبن","5"),
  nuzhaItem("appetizers","Cucumber lassi","خيار بالزبادي","5"),

  // Curries / إيدامات نزهة
  nuzhaItem("curries","Brinjal / eggplant curry","مسقع","7",{image:"gallery-images/kitchen--moussaka.jpg",missingImage:false}),
  nuzhaItem("curries","Lady finger curry","بامية","7"),
  nuzhaItem("curries","Mixed vegetable curry","خضار مشكل","7"),
  nuzhaItem("curries","Spinach / saag","ملوخية","7",{reviewEn:"English says spinach/saag while Arabic says molokhia; confirm the dish.",reviewAr:"الإنجليزية تذكر السبانخ بينما العربية تذكر الملوخية؛ يرجى التأكيد."}),
  nuzhaItem("curries","Potato with meat","لحم مع بطاطس","15"),
  nuzhaItem("curries","Chicken curry","صالونة دجاج","12"),
  nuzhaItem("curries","Lentils","عدس جار","8"),
  nuzhaItem("curries","Mutton curry","إيدام لحم","25")
];
