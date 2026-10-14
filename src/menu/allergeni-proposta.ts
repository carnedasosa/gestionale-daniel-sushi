// Proposta degli allergeni di ogni piatto, ricavata dagli ingredienti scritti nel menù.
// È solo una bozza da verificare con Daniel: nel database va con allergeni_confermati = false,
// quindi il cliente continua a leggere «Allergeni in verifica» finché Daniel non spunta il piatto.
// Le domande servono a chiarire ciò che il menù non dice (marche, salse, impasti, fritture).
import { ALLERGENI, type CodiceAllergene } from '@/domain/allergeni'
import type { AllergeniVoci } from '@/domain/allergeni-poke'
import type { GruppoPoke } from './importa'

interface Ingrediente { allergeni: CodiceAllergene[]; domanda?: string }

const ING = {
  'riso per sushi': { allergeni: [], domanda: 'Il condimento del riso per sushi (aceto di riso, mirin) contiene solfiti? Controllare l’etichetta.' },
  'riso bianco': { allergeni: [] },
  'riso venere': { allergeni: [] },
  'insalata iceberg': { allergeni: [] },
  salmone: { allergeni: ['pesce'] },
  tonno: { allergeni: ['pesce'] },
  'pesce bianco': { allergeni: ['pesce'] },
  spigola: { allergeni: ['pesce'] },
  tobiko: { allergeni: ['pesce'], domanda: 'Il tobiko colorato a volte contiene soia o solfiti: controllare l’etichetta.' },
  gambero: { allergeni: ['crostacei'] },
  'gambero rosso': { allergeni: ['crostacei'] },
  scampo: { allergeni: ['crostacei'] },
  'polpa di granchio': { allergeni: ['crostacei','pesce','glutine','uova'], domanda: 'La polpa di granchio è granchio vero o surimi? Il surimi contiene di solito pesce, glutine e uova (a volte soia): se è granchio vero restano solo i crostacei.' },
  polpo: { allergeni: ['molluschi'] },
  tempura: { allergeni: ['glutine'], domanda: 'La pastella della tempura contiene uova? La frittura è nello stesso olio di gamberi e pesce?' },
  panko: { allergeni: ['glutine'] },
  panatura: { allergeni: ['glutine'], domanda: 'La panatura dei gamberi in crosta contiene uova o latte?' },
  kataifi: { allergeni: ['glutine'] },
  'granella croccante': { allergeni: ['glutine'], domanda: 'Di cosa è fatta la «granella croccante» del maki fritto? (tempura/panko = glutine; frutta secca = frutta a guscio)' },
  philadelphia: { allergeni: ['latte'] },
  'philadelphia senza lattosio': { allergeni: ['latte'] },
  stracciatella: { allergeni: ['latte'] },
  'formaggio francese': { allergeni: ['latte'] },
  feta: { allergeni: ['latte'] },
  avocado: { allergeni: [] },
  'crema di avocado': { allergeni: [] },
  mango: { allergeni: [] },
  cetriolo: { allergeni: [] },
  zucchine: { allergeni: [] },
  mais: { allergeni: [] },
  carote: { allergeni: [] },
  pomodorini: { allergeni: [] },
  'olive denocciolate': { allergeni: [] },
  zucca: { allergeni: [] },
  'semi di girasole e lino': { allergeni: [] },
  verdure: { allergeni: [] },
  cipollotto: { allergeni: [] },
  lime: { allergeni: [] },
  menta: { allergeni: [] },
  'frutta di stagione': { allergeni: [] },
  'olio extravergine': { allergeni: [] },
  'chips di patata dolce': { allergeni: [] },
  zenzero: { allergeni: [], domanda: 'Lo zenzero marinato contiene solfiti (conservanti)? Controllare l’etichetta.' },
  'pollo piastrato': { allergeni: [] },
  sesamo: { allergeni: ['sesamo'] },
  'granella di pistacchio': { allergeni: ['frutta_a_guscio'] },
  'vellutata di pistacchio': { allergeni: ['frutta_a_guscio'], domanda: 'La vellutata/crema di pistacchio contiene latte?' },
  mandorla: { allergeni: ['frutta_a_guscio'] },
  anacardi: { allergeni: ['frutta_a_guscio'] },
  teriyaki: { allergeni: ['glutine','soia'], domanda: 'La teriyaki è fatta con salsa di soia di frumento? Contiene mirin o sake (solfiti)?' },
  'salsa di soia': { allergeni: ['glutine','soia'], domanda: 'La salsa di soia è di frumento (glutine) o tamari senza glutine?' },
  'salsa unagi': { allergeni: ['glutine','soia'], domanda: 'La salsa unagi contiene mirin/sake (solfiti) o estratto di pesce?' },
  maionese: { allergeni: ['uova'], domanda: 'La maionese (anche quella giapponese) contiene senape?' },
  'mayo piccante': { allergeni: ['uova'], domanda: 'Con cosa è fatta la mayo piccante? Se c’è sriracha, spesso contiene solfiti.' },
  'salsa spicy': { allergeni: ['uova'], domanda: 'Com’è fatta la salsa spicy? (base maionese = uova; sriracha = spesso solfiti)' },
  'mayo al tartufo': { allergeni: ['uova'] },
  'mayo alla barbabietola': { allergeni: ['uova'], domanda: 'La salsa/mayo alla barbabietola è a base di maionese?' },
  'salsa allo zafferano': { allergeni: ['uova'], domanda: 'La salsa/mayo allo zafferano è a base di maionese?' },
  'chutney di mango': { allergeni: [], domanda: 'Il chutney di mango contiene senape (semi) o solfiti? Controllare l’etichetta.' },
  'vellutata di arancia': { allergeni: [], domanda: 'Com’è fatta la vellutata di arancia? (latte, burro, maionese?)' },
  'salsa al lime': { allergeni: [], domanda: 'Com’è fatta la salsa al lime della poke? (soia, maionese?)' },
  'sweet chili': { allergeni: [] },
  sriracha: { allergeni: ['solfiti'], domanda: 'La sriracha che usate contiene solfiti? (quella più diffusa contiene bisolfito di sodio)' },
  'cipolla fritta': { allergeni: ['glutine'], domanda: 'La cipolla fritta/croccante è infarinata (glutine)?' },
  'tempura flakes': { allergeni: ['glutine'] },
  'alga wakame': { allergeni: ['sesamo','soia'], domanda: 'L’insalata di alga wakame è un prodotto pronto? Di solito contiene sesamo e soia, a volte glutine: controllare l’etichetta.' },
  edamame: { allergeni: ['soia'] },
  tofu: { allergeni: ['soia'] },
  'condimento della tartare': { allergeni: [], domanda: 'IMPORTANTE: con cosa è condita la tartare? (salsa di soia, olio o semi di sesamo, maionese?)' },
  'marinatura del salmone': { allergeni: [], domanda: 'Con cosa è marinato il salmone del crispy rice? (salsa di soia = glutine e soia)' },
  'involtini primavera': { allergeni: ['glutine','soia'], domanda: 'Gli involtini primavera sono un prodotto pronto? Controllare l’etichetta (spesso anche sedano, uova, sesamo).' },
  uovo: { allergeni: ['uova'] },
  patatine: { allergeni: [], domanda: 'Le patatine sono fritte nello stesso olio della tempura e dei gamberi? (contaminazione con glutine e crostacei)' },
  cotoletta: { allergeni: ['glutine'], domanda: 'Che carne è la cotoletta? La panatura contiene uova o latte?' },
  'maiale caramellato': { allergeni: ['glutine','soia'], domanda: 'Con cosa è caramellata la pancia di maiale? (salsa di soia, mirin o sake = solfiti)' },
  takoyaki: { allergeni: ['glutine','uova','pesce','soia'], domanda: 'I takoyaki sono pronti o fatti da voi? Di solito: impasto con farina e uova, salsa takoyaki (soia, glutine), maionese e fiocchi di tonnetto (pesce).' },
  'pane bao': { allergeni: ['glutine'], domanda: 'L’impasto dei bao contiene latte o soia? Controllare l’etichetta.' },
  'pulled pork': { allergeni: [], domanda: 'Con quale salsa è condito il pulled pork? Le salse barbecue spesso contengono senape, sedano, glutine o soia.' },
  'ravioli gyoza': { allergeni: ['glutine','soia'], domanda: 'I gyoza sono un prodotto pronto? Controllare l’etichetta (spesso anche sesamo).' },
  'ripieno di maiale e verza': { allergeni: [] },
  udon: { allergeni: ['glutine'] },
  'spaghetti di riso': { allergeni: [] },
  'salsa per saltare': { allergeni: ['glutine','soia'], domanda: 'Con quali salse saltate noodles e spaghetti? (soia = glutine e soia; salsa d’ostrica = molluschi; olio di sesamo = sesamo)' },
  'carne di maiale': { allergeni: [] },
  'noodles del ramen': { allergeni: ['glutine'], domanda: 'I noodles del ramen contengono uova?' },
  'brodo di manzo': { allergeni: ['sedano'], domanda: 'Il brodo contiene sedano o dado (spesso con sedano, glutine, soia)?' },
  'uovo sodo marinato': { allergeni: ['uova','glutine','soia'], domanda: 'L’uovo è marinato nella salsa di soia?' },
  'alga nori': { allergeni: [] },
  'pollo in tempura': { allergeni: ['glutine'], domanda: 'La pastella del pollo in tempura contiene uova?' },
  // Dessert e bevande: prodotti pronti, l’etichetta decide.
  sorbetto: { allergeni: [], domanda: 'Il sorbetto contiene latte o altri allergeni? Controllare l’etichetta.' },
  'dolce al cioccolato': { allergeni: ['glutine','uova','latte','soia'], domanda: 'Controllare l’etichetta del dolce (frutta a guscio in tracce? lecitina di soia?).' },
  nocciole: { allergeni: ['frutta_a_guscio'] },
  'dolce da forno': { allergeni: ['glutine','uova','latte'], domanda: 'Controllare l’etichetta del dolce.' },
  tiramisù: { allergeni: ['glutine','uova','latte'], domanda: 'Il tiramisù contiene liquore (solfiti)? Controllare l’etichetta.' },
  'dolce sconosciuto': { allergeni: ['glutine','uova','latte','soia','frutta_a_guscio'], domanda: 'IMPORTANTE: proposta larga perché non sappiamo com’è fatto: togliere ciò che non c’è guardando l’etichetta.' },
  bibita: { allergeni: [] },
  birra: { allergeni: ['glutine'] },
  'birra senza glutine': { allergeni: [], domanda: 'Se in etichetta c’è «orzo» (deglutinato) evidenziato, spuntare Glutine anche se è senza glutine.' },
} satisfies Record<string,Ingrediente>

export type ChiaveIngrediente = keyof typeof ING
export const INGREDIENTI: Record<ChiaveIngrediente,Ingrediente> = ING

/** Box: pezzi presi da altri piatti (numero) o da un’intera categoria «a scelta dello chef» (id). */
export interface VoceProposta { categoria: string; numero: number | null; nome: string; ingredienti: ChiaveIngrediente[]; contiene?: (number | string)[]; domanda?: string }

const R = 'riso per sushi' as const
const sushi = (categoria: string, numero: number, nome: string, ...ingredienti: ChiaveIngrediente[]): VoceProposta => ({ categoria,numero,nome,ingredienti: [R,...ingredienti] })
const piatto = (categoria: string, numero: number | null, nome: string, ...ingredienti: ChiaveIngrediente[]): VoceProposta => ({ categoria,numero,nome,ingredienti })
const DOMANDA_SESAMO = 'Gli uramaki sono passati nei semi di sesamo all’esterno?'
const DOMANDA_BOX = 'Quali pezzi mettete di solito? Ora la proposta somma gli allergeni di tutti i piatti che possono finirci: se i pezzi sono sempre gli stessi si può restringere.'

export const PROPOSTA: VoceProposta[] = [
  piatto('tartare',1,'Salmone','salmone','condimento della tartare'),
  piatto('tartare',2,'Tonno','tonno','condimento della tartare'),
  piatto('tartare',3,'Mini Salmone','salmone','kataifi','condimento della tartare'),
  piatto('tartare',4,'Mini Tonno','tonno','granella di pistacchio','condimento della tartare'),
  piatto('sashimi',5,'Salmone','salmone'),
  piatto('sashimi',6,'Tonno','tonno'),
  piatto('starter',44,'Alga wakame','alga wakame'),
  piatto('starter',45,'Edamame','edamame'),
  sushi('starter',92,'Crispy Rice Salmone','salmone','marinatura del salmone','mayo piccante'),
  piatto('starter',101,'Involtini Primavera Vegetariani','involtini primavera'),
  piatto('starter',46,'Gamberi in tempura','gambero','tempura'),
  piatto('starter',47,'Gambero in crosta di pistacchio','gambero','panatura','granella di pistacchio'),
  piatto('starter',48,'Gambero in crosta di mandorla','gambero','panatura','mandorla'),
  piatto('starter',81,'Involtini Panko & Salm','gambero','panko','salmone','philadelphia','teriyaki','sesamo'),
  piatto('starter',110,'Tamago Crispy','uovo','tempura','maionese'),
  piatto('starter',111,'Patatine fritte','patatine'),
  piatto('starter',112,'Cotoletta in tempura','cotoletta','tempura','patatine'),
  piatto('starter',113,'Kakuni','maiale caramellato','riso bianco'),
  piatto('starter',114,'Takoyaki','polpo','takoyaki'),
  piatto('starter',116,'Bao Pulled Pork','pane bao','pulled pork'),
  piatto('starter',117,'Bao Gambero in Tempura','pane bao','gambero','tempura'),
  sushi('sushi-gio',7,'Gio salmone','salmone','kataifi'),
  sushi('sushi-gio',8,'Gio Maguro','tonno','kataifi'),
  sushi('sushi-gio',9,'Philadelphia Gio','salmone','philadelphia'),
  sushi('sushi-gio',10,'Gio Tonno & Scampi','tonno','scampo','teriyaki'),
  sushi('sushi-gio',11,'Gio Salm & Gambero','salmone','gambero rosso','teriyaki'),
  sushi('sushi-gio',12,'Gio Flame Salm & Scampo','salmone','scampo','mandorla','teriyaki'),
  sushi('sushi-gio',13,'Gio Flame Salm & Shrimp','salmone','gambero rosso','vellutata di pistacchio','granella di pistacchio'),
  sushi('sushi-gio',82,'Gio Full immersion','salmone','salsa spicy'),
  sushi('sushi-gio',83,'Gio fresh & salm','salmone','philadelphia','granella di pistacchio'),
  sushi('sushi-gio',84,'Gio fresh & Tuna','tonno','philadelphia','granella di pistacchio'),
  sushi('hosomaki',14,'Salmone','alga nori','salmone'),
  sushi('hosomaki',15,'Tonno','alga nori','tonno'),
  sushi('hosomaki',16,'Gambero in tempura','alga nori','gambero','tempura'),
  sushi('hosomaki',17,'Scampo','alga nori','scampo'),
  sushi('hosomaki',18,'Gambero rosso','alga nori','gambero rosso'),
  sushi('hosomaki',19,'Hosomaki fritto','alga nori','salmone','philadelphia','frutta di stagione','tempura'),
  sushi('hosomaki',91,'Maki fritto','alga nori','salmone','granella croccante','vellutata di pistacchio','teriyaki','tempura'),
  sushi('nigiri',20,'Salmone','salmone'),
  sushi('nigiri',21,'Tonno','tonno'),
  sushi('nigiri',22,'Salmone scottato','salmone'),
  sushi('nigiri',23,'Tonno scottato','tonno'),
  sushi('nigiri',24,'Tartare Scampo','scampo','mandorla'),
  sushi('nigiri',25,'Tartare Gambero rosso','gambero rosso','granella di pistacchio'),
  sushi('nigiri',97,'White','pesce bianco','sesamo'),
  sushi('triangolini',93,'SalmThree','salmone','maionese','sesamo','mayo piccante','teriyaki'),
  sushi('triangolini',94,'TonnFive','tonno','maionese','sesamo','mayo piccante','teriyaki'),
  sushi('triangolini',95,'GamberEight','gambero','tempura','maionese','sesamo','mayo piccante','teriyaki'),
  { ...sushi('uramaki',26,'Salmone roll','alga nori','salmone','avocado','philadelphia'),domanda: DOMANDA_SESAMO },
  { ...sushi('uramaki',27,'Tonno roll','alga nori','tonno','avocado','philadelphia'),domanda: DOMANDA_SESAMO },
  { ...sushi('uramaki',28,'Gambero in tempura','alga nori','gambero','tempura','avocado','philadelphia'),domanda: DOMANDA_SESAMO },
  sushi('special-roll',29,'Sake roll','salmone','philadelphia','avocado','kataifi','teriyaki'),
  sushi('special-roll',30,'Maguro roll','tonno','philadelphia','avocado','kataifi','teriyaki'),
  sushi('special-roll',31,'Shrimp roll','gambero','tempura','avocado','tonno','teriyaki','vellutata di pistacchio'),
  sushi('special-roll',32,'Daniel\'s roll','salmone','avocado','gambero rosso','vellutata di pistacchio'),
  sushi('special-roll',33,'Spicy Maguro roll','tonno','philadelphia','teriyaki','salsa spicy'),
  sushi('special-roll',34,'Salm & Ph roll','salmone','philadelphia'),
  sushi('special-roll',35,'Tiger Flame roll','gambero','tempura','salmone','kataifi','teriyaki'),
  sushi('special-roll',36,'Maguro Ph roll','tonno','philadelphia'),
  sushi('special-roll',37,'Spicy Salm roll','salmone','philadelphia','teriyaki','salsa spicy'),
  sushi('special-roll',38,'Prawn & Tuna','tonno','avocado','scampo','mandorla'),
  sushi('special-roll',39,'Mango roll','tonno','mango','chutney di mango','teriyaki'),
  sushi('special-roll',40,'Mediterraneo roll','salmone','formaggio francese','menta','olio extravergine'),
  sushi('special-roll',41,'Apulia roll','salmone','avocado','stracciatella','gambero rosso','granella di pistacchio'),
  sushi('special-roll',52,'Crab & Salm roll','polpa di granchio','avocado','salmone','teriyaki','olio extravergine'),
  sushi('special-roll',53,'Crab & Flame Salm roll','polpa di granchio','philadelphia','avocado','salmone','teriyaki','kataifi'),
  sushi('special-roll',54,'Tuna & Crab roll','polpa di granchio','philadelphia','tonno','teriyaki','sesamo'),
  sushi('special-roll',55,'Fried onion & Crab roll','polpa di granchio','avocado','salmone','teriyaki','cipolla fritta'),
  sushi('special-roll',56,'Rainbow roll','salmone','avocado','tonno','spigola','teriyaki'),
  sushi('special-roll',57,'Lime & Bass roll','salmone','avocado','teriyaki','lime','tobiko'),
  sushi('special-roll',58,'Fried onion & Salm roll','salmone','philadelphia','teriyaki','cipolla fritta'),
  sushi('special-roll',66,'Mango & Tuna roll','tonno','mango','salmone','teriyaki','chutney di mango','mandorla'),
  sushi('special-roll',67,'PistacchioLovers roll','gambero','tempura','avocado','salmone','vellutata di pistacchio','teriyaki','granella di pistacchio'),
  sushi('special-roll',68,'Salmon Fuji roll','gambero','tempura','salmone','philadelphia','tobiko'),
  sushi('special-roll',69,'Daiquiri roll','salmone','mango','lime','sesamo'),
  sushi('special-roll',70,'Truffle & Co. roll','gambero','tempura','avocado','salmone','mayo al tartufo','anacardi'),
  sushi('special-roll',71,'Paradise roll','gambero','tempura','avocado','tonno','teriyaki','kataifi'),
  sushi('special-roll',72,'GamberOne','gambero','tonno','teriyaki','crema di avocado','kataifi'),
  sushi('special-roll',73,'GamberTwo','gambero','salmone','teriyaki','crema di avocado','kataifi'),
  sushi('special-roll',76,'GamberThree','gambero','tempura','cetriolo','salmone','chutney di mango','teriyaki','granella di pistacchio','vellutata di pistacchio'),
  sushi('special-roll',77,'GamberFour','gambero','cetriolo','salmone','mayo alla barbabietola','sesamo'),
  sushi('special-roll',78,'TonnTwo','tonno','cetriolo','sesamo','mayo alla barbabietola'),
  sushi('special-roll',79,'SalmTwo','salmone','cetriolo','sesamo','mayo alla barbabietola'),
  sushi('special-roll',85,'TonnThree','tonno','teriyaki','lime','cipolla fritta'),
  sushi('special-roll',86,'TonnFour','tonno','avocado','salsa allo zafferano','tobiko'),
  sushi('special-roll',87,'SalmTwo','salmone','avocado','salsa allo zafferano','tobiko'),
  sushi('special-roll',89,'GamberSix','gambero','tempura','salmone','teriyaki','mandorla'),
  sushi('special-roll',90,'GamberSeven','gambero','tempura','salmone','salsa allo zafferano','tobiko'),
  sushi('special-roll',98,'WhiteOne','salmone','avocado','pesce bianco','teriyaki','sesamo'),
  sushi('special-roll',99,'WhiteTwo','pesce bianco','avocado','teriyaki','lime','tobiko'),
  sushi('special-roll',100,'WhiteThree','pesce bianco','avocado','teriyaki','vellutata di arancia','tobiko'),
  piatto('poke-bowl',60,'Philadelphia\'s poke','riso bianco','salmone','tonno','zucchine','mais','carote','salsa di soia','mayo piccante','philadelphia','mandorla'),
  piatto('poke-bowl',61,'Daniel\'s poke','riso bianco','gambero','tempura','salmone','avocado','zucchine','vellutata di pistacchio','teriyaki','granella di pistacchio'),
  piatto('poke-bowl',62,'Maglielano\'s poke','riso bianco','salmone','tonno','avocado','mais','carote','salsa di soia','teriyaki','mayo al tartufo','stracciatella','anacardi'),
  piatto('poke-bowl',63,'Colorful\'s poke','riso bianco','salmone','tonno','avocado','mango','salsa di soia','teriyaki','chutney di mango','sesamo'),
  piatto('poke-bowl',64,'Aman\'s poke','riso bianco','salmone','tonno','edamame','alga wakame','salsa unagi','sesamo','cipolla fritta'),
  piatto('poke-bowl',65,'Sunflower\'s poke','riso bianco','salmone','gambero','tempura','carote','pomodorini','teriyaki','sweet chili','sesamo','zucca','semi di girasole e lino'),
  piatto('poke-bowl',80,'Voglia\'s poke','riso bianco','teriyaki','salsa di soia','mayo alla barbabietola','crema di avocado','cetriolo','pomodorini','salmone','tonno','philadelphia','sesamo'),
  { ...piatto('box',42,'Crazy sushi'),contiene: ['nigiri','sushi-gio','hosomaki','special-roll'],domanda: DOMANDA_BOX },
  { ...piatto('box',43,'Maglielano box'),contiene: ['nigiri','sushi-gio','hosomaki','special-roll'],domanda: DOMANDA_BOX },
  { ...piatto('box',49,'Daniel\'s sushi small box'),contiene: [9,20,26,28,46] },
  { ...piatto('box',50,'Daniel\'s sushi medium box'),contiene: [5,9,20,26,'special-roll',19,46],domanda: DOMANDA_BOX },
  { ...piatto('box',51,'Daniel\'s sushi large box'),contiene: [5,20,21,26,'special-roll',19,46],domanda: DOMANDA_BOX },
  piatto('primi',102,'Gyoza','ravioli gyoza','ripieno di maiale e verza'),
  piatto('primi',115,'Gyoza Vegetariani','ravioli gyoza','verdure'),
  piatto('primi',103,'Noodles di Verdure','udon','verdure','tofu','sriracha','salsa per saltare'),
  piatto('primi',104,'Noodles di Carne','udon','verdure','carne di maiale','sriracha','salsa per saltare'),
  piatto('primi',105,'Noodles di gamberi','udon','verdure','gambero','sriracha','salsa per saltare'),
  piatto('primi',106,'Spaghetti di riso di Verdure','spaghetti di riso','verdure','tofu','sriracha','salsa per saltare'),
  piatto('primi',107,'Spaghetti di riso di Carne','spaghetti di riso','verdure','carne di maiale','sriracha','salsa per saltare'),
  piatto('primi',108,'Spaghetti di riso di gamberi','spaghetti di riso','verdure','gambero','sriracha','salsa per saltare'),
  piatto('primi',109,'Ramen','noodles del ramen','brodo di manzo','mais','alga nori','cipollotto','carne di maiale','uovo sodo marinato','sriracha'),
  piatto('dessert',null,'Sorbetto al limone','sorbetto'),
  piatto('dessert',null,'Sorbetto alla mela verde','sorbetto'),
  piatto('dessert',null,'Soufflé al cioccolato','dolce al cioccolato'),
  piatto('dessert',null,'Soufflé al cioccolato bianco','dolce al cioccolato'),
  piatto('dessert',null,'Torta ai 3 cioccolati','dolce al cioccolato'),
  piatto('dessert',null,'Torta Kinder','dolce al cioccolato','nocciole'),
  piatto('dessert',null,'Torta al pistacchio','dolce da forno','granella di pistacchio'),
  piatto('dessert',null,'Torta al mango','dolce da forno','mango'),
  piatto('dessert',null,'Cheesecake ai frutti di bosco','dolce da forno'),
  piatto('dessert',null,'Tiramisù','tiramisù'),
  piatto('dessert',null,'Bomboniere','dolce sconosciuto'),
  piatto('dessert',null,'Tartufo nero','dolce sconosciuto'),
  piatto('dessert',null,'Tartufo bianco','dolce sconosciuto'),
  ...['Acqua naturale','Acqua frizzante','Acqua naturale 0,5 L','Coca Cola','Coca Cola Zero','Fanta','Thè pesca','Thè limone'].map(n => piatto('beverage',null,n,'bibita')),
  ...['Birra Lemon','Birra Zero','Birra Corona','Birra Asahi','Birra Heineken'].map(n => piatto('beverage',null,n,'birra')),
  piatto('beverage',null,'Birra Igea','birra senza glutine'),
]

/** Ingredienti della poke composta, gruppo per gruppo, con i nomi esatti del database. */
export const PROPOSTA_POKE: Record<string,Record<string,ChiaveIngrediente[]>> = {
  Base: { 'Riso bianco': ['riso bianco'],'Riso Venere': ['riso venere'],'Insalata iceberg': ['insalata iceberg'] },
  Proteine: {
    'Salmone crudo': ['salmone'],'Salmone scottato': ['salmone'],'Tonno crudo': ['tonno'],'Tonno scottato': ['tonno'],'Gamberi al vapore': ['gambero'],
    'Gamberi in tempura': ['gambero','tempura'],'Pollo piastrato': ['pollo piastrato'],'Pollo in tempura': ['pollo in tempura'],'Pesce bianco': ['pesce bianco'],'Tofu': ['tofu'],'Formaggio feta': ['feta'],
  },
  Condimenti: {
    'Alga wakame': ['alga wakame'],'Edamame': ['edamame'],'Cetrioli': ['cetriolo'],'Mango': ['mango'],'Carote': ['carote'],'Zucchine': ['zucchine'],'Mais': ['mais'],
    'Avocado': ['avocado'],'Pomodorini': ['pomodorini'],'Olive denocciolate': ['olive denocciolate'],'Zenzero': ['zenzero'],
  },
  Salse: {
    'Teriyaki': ['teriyaki'],'Soia': ['salsa di soia'],'Mayo piccante': ['mayo piccante'],'Mayo': ['maionese'],'Vellutata al pistacchio': ['vellutata di pistacchio'],
    'Chutney al mango': ['chutney di mango'],'Crema di avocado': ['crema di avocado'],'Sweet chilli': ['sweet chili'],'Mayo al tartufo': ['mayo al tartufo'],
    'Salsa barbabietola': ['mayo alla barbabietola'],'Mayo allo zafferano': ['salsa allo zafferano'],'Salsa al lime': ['salsa al lime'],
  },
  Topping: {
    'Cipolla fritta': ['cipolla fritta'],'Granella pistacchio': ['granella di pistacchio'],'Filangé mandorla': ['mandorla'],'Kataifi': ['kataifi'],'Anacardi': ['anacardi'],
    'Sesamo': ['sesamo'],'Philadelphia senza lattosio': ['philadelphia senza lattosio'],'Stracciatella': ['stracciatella'],'Tempura flakes': ['tempura flakes'],'Chips di patata dolce': ['chips di patata dolce'],
  },
}

export interface PropostaRisolta { categoria: string; numero: number | null; nome: string; allergeni: CodiceAllergene[]; ingredienti: ChiaveIngrediente[]; domande: string[] }

const ORDINE = ALLERGENI.map(a => a.codice)
function ordina(codici: Iterable<CodiceAllergene>): CodiceAllergene[] { const s = new Set(codici); return ORDINE.filter(c => s.has(c)) }
function senzaDoppioni<T>(xs: T[]): T[] { return [...new Set(xs)] }

/** Allergeni e domande di ogni piatto; i box sommano i piatti che contengono. */
export function risolviProposta(voci: VoceProposta[] = PROPOSTA): PropostaRisolta[] {
  const perNumero = new Map(voci.filter(v => v.numero !== null).map(v => [v.numero!,v]))
  const ingredientiDi = (v: VoceProposta): ChiaveIngrediente[] => senzaDoppioni([
    ...v.ingredienti,
    ...(v.contiene ?? []).flatMap(x => typeof x === 'number'
      ? ingredientiDi(perNumero.get(x) ?? (() => { throw new Error(`Box ${v.nome}: piatto n. ${x} sconosciuto`) })())
      : voci.filter(p => p.categoria === x).flatMap(ingredientiDi)),
  ])
  return voci.map(v => {
    const ingredienti = ingredientiDi(v)
    return {
      categoria: v.categoria,numero: v.numero,nome: v.nome,ingredienti,
      allergeni: ordina(ingredienti.flatMap(i => INGREDIENTI[i].allergeni)),
      domande: senzaDoppioni([...(v.domanda ? [v.domanda] : []),...ingredienti.flatMap(i => INGREDIENTI[i].domanda ? [INGREDIENTI[i].domanda!] : [])]),
    }
  })
}

/** Allergeni proposti per ogni ingrediente della poke, nel formato di poke_config.allergeni_voci. */
export function allergeniPokeProposti(gruppi: GruppoPoke[]): AllergeniVoci {
  const voci: AllergeniVoci = {}
  for (const g of gruppi) {
    voci[g.nome] = {}
    for (const v of g.voci) {
      const ingredienti = PROPOSTA_POKE[g.nome]?.[v]
      if (!ingredienti) throw new Error(`Poke: manca la proposta per ${g.nome} › ${v}`)
      voci[g.nome][v] = ordina(ingredienti.flatMap(i => INGREDIENTI[i].allergeni))
    }
  }
  return voci
}

const lit = (s: string) => `'${s.replace(/'/g,"''")}'`
/** SQL che carica la proposta senza confermarla. Tocca solo piatti e poke mai compilati: non sovrascrive il lavoro di Daniel. */
export function sqlProposta(gruppi: GruppoPoke[]): string {
  return [
    '-- Generato da scripts/allergeni-proposta.ts: proposta da verificare con Daniel, NON confermata.',
    '-- Aggiorna solo i piatti mai compilati, così non sovrascrive ciò che Daniel ha già verificato.',
    'begin;',
    ...risolviProposta().map(p => `update public.piatti set allergeni = array[${p.allergeni.map(lit).join(',')}]::text[], aggiornato_il = now() where categoria_id = ${lit(p.categoria)} and ${p.numero === null ? `numero is null and nome = ${lit(p.nome)}` : `numero = ${p.numero}`} and not allergeni_confermati and allergeni = '{}';`),
    `update public.poke_config set allergeni_voci = ${lit(JSON.stringify(allergeniPokeProposti(gruppi)))}::jsonb where id = 1 and not allergeni_confermati and allergeni_voci = '{}'::jsonb;`,
    'commit;','',
  ].join('\n')
}
