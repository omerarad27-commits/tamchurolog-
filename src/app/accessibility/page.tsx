import type { Metadata } from "next";

import { A11Y_CONTACT, A11Y_STATEMENT_UPDATED } from "@/lib/a11y";

/*
 * The accessibility statement.
 *
 * A page rather than a PDF on purpose: the one document that promises the site
 * is readable must not be the one document that needs a reader to open it.
 *
 * Indexable, and one of the very few routes here that is — the regulations
 * expect a visitor to be able to find it, including from outside the site.
 */
export const metadata: Metadata = {
  title: "הצהרת נגישות",
  description:
    "הצהרת הנגישות של תמחורולוג: רמת הנגישות באתר, ההתאמות הזמינות, ופרטי רכז הנגישות.",
  alternates: { canonical: "/accessibility" },
};

const UPDATED = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date(A11Y_STATEMENT_UPDATED));

export default function AccessibilityPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-document flex-1 flex-col gap-8 px-5 py-10"
    >
      <header className="flex flex-col gap-2">
        <h1>הצהרת נגישות</h1>
        <p className="text-muted">
          עודכנה לאחרונה ב־<span className="numeric">{UPDATED}</span>
        </p>
      </header>

      <Section title="המחויבות שלנו">
        <p>
          תמחורולוג הוא שירות שבו בעלי מקצוע שולחים הצעות מחיר ללקוחות שלהם. אנחנו
          רואים בנגישות האתר חלק מהשירות עצמו, ולא תוספת לו: אדם שמקבל הצעת מחיר
          צריך להיות מסוגל לקרוא אותה, להבין אותה ולהחליט לגביה בכוחות עצמו.
        </p>
        <p>
          אנחנו פועלים כדי שהאתר יהיה נגיש לאנשים עם מוגבלות, ומתקנים ליקויים
          שמתגלים או שמדווחים לנו.
        </p>
      </Section>

      <Section title="רמת הנגישות באתר">
        <p>
          האתר הונגש בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות
          לשירות), התשע״ג־2013, ולתקן הישראלי ת״י 5568 ברמה AA, המבוסס על הנחיות{" "}
          <span className="numeric">WCAG 2.1</span> של ארגון{" "}
          <span className="numeric">W3C</span>.
        </p>
        <p>ההנגשה נעשתה בקוד האתר עצמו, ולא באמצעות תוסף חיצוני.</p>
      </Section>

      <Section title="מה נגיש באתר">
        <ul className="flex list-disc flex-col gap-2 pe-5">
          <li>
            <strong>ניווט מקלדת מלא.</strong> אפשר להגיע לכל קישור, כפתור ושדה
            באמצעות מקש Tab, וסימון ברור מראה תמיד היכן המיקוד נמצא.
          </li>
          <li>
            <strong>קישור דילוג לתוכן.</strong> ההקשה הראשונה בכל עמוד מציעה דילוג
            ישיר לתוכן העיקרי, בלי מעבר על התפריטים.
          </li>
          <li>
            <strong>תמיכה בקוראי מסך.</strong> האתר מוגדר בעברית ובכיוון מימין
            לשמאל, עם מבנה כותרות היררכי, אזורי תוכן מסומנים, תוויות לכל שדה טופס,
            ותיאור חלופי לכל תמונה.
          </li>
          <li>
            <strong>ניגודיות צבעים.</strong> יחסי הניגודיות בטקסט עומדים בדרישות
            רמה AA.
          </li>
          <li>
            <strong>מידע שאינו נשען על צבע בלבד.</strong> מצב של הצעת מחיר מסומן
            גם במילים, ולא רק בגוון.
          </li>
          <li>
            <strong>יעדי מגע גדולים.</strong> כל כפתור בטלפון גדול מספיק להקשה
            בטוחה ביד אחת.
          </li>
        </ul>
      </Section>

      <Section title="תפריט התאמות אישיות">
        <p>
          בכל עמוד באתר מופיע כפתור נגישות קבוע בפינה התחתונה־שמאלית של המסך.
          פתיחתו מאפשרת להתאים את התצוגה: הגדלת הטקסט, מעבר לניגודיות גבוהה או
          לתצוגה כהה, הדגשת קישורים, עצירת אנימציות, מעבר לפונט קריא והגדלת סמן
          העכבר. אפשר גם לאפס הכל בלחיצה אחת.
        </p>
        <p>
          ההעדפות נשמרות בדפדפן שלכם בלבד ונשארות בתוקף גם בביקורים הבאים. הן אינן
          נשלחות אלינו ואינן נשמרות אצלנו.
        </p>
      </Section>

      <Section title="מה עדיין אינו נגיש במלואו">
        <p>
          אנחנו מעדיפים לומר זאת במפורש מאשר להצהיר שהאתר נגיש לחלוטין:
        </p>
        <ul className="flex list-disc flex-col gap-2 pe-5">
          <li>
            <strong>תוכן שכותבים בעלי המקצוע.</strong> תיאורי העבודות בהצעות המחיר
            ושאלות בשאלוני הלקוחות נכתבים על ידי בעל המקצוע ולא על ידינו, ואיננו
            יכולים להתחייב על בהירות הניסוח שלהם.
          </li>
          <li>
            <strong>לוגו שהעלה בעל המקצוע.</strong> התיאור החלופי של הלוגו הוא שם
            העסק. אם הלוגו מכיל טקסט נוסף, הטקסט הזה אינו מוקרא.
          </li>
          <li>
            <strong>שירותים חיצוניים.</strong> שליחת הצעה בוואטסאפ מעבירה אתכם
            לאפליקציה של ספק חיצוני, שנגישותה אינה בשליטתנו.
          </li>
        </ul>
        <p>
          אם אחד מאלה מונע מכם להשלים פעולה, פנו אלינו בפרטים שלמטה ונסייע לכם
          באופן אישי.
        </p>
      </Section>

      <Section title="נתקלתם בבעיה? ספרו לנו">
        <p>
          אם מצאתם באתר עמוד, כפתור או תוכן שאינם נגישים, נשמח לשמוע. תיאור קצר של
          מה ניסיתם לעשות, באיזה עמוד, ובאיזה דפדפן או מכשיר, יעזור לנו לתקן מהר.
        </p>
        <p>אנחנו מתחייבים להשיב לכל פנייה בנושא נגישות ולטפל בה.</p>

        <dl className="mt-2 flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <ContactRow label="רכז הנגישות">{A11Y_CONTACT.name}</ContactRow>
          <ContactRow label="דוא״ל">
            <a
              href={`mailto:${A11Y_CONTACT.email}`}
              className="font-semibold text-brand hover:underline"
            >
              {A11Y_CONTACT.email}
            </a>
          </ContactRow>
          <ContactRow label="טלפון">
            <a
              href={A11Y_CONTACT.phoneHref}
              className="numeric font-semibold text-brand hover:underline"
            >
              {A11Y_CONTACT.phone}
            </a>
          </ContactRow>
        </dl>

        <p className="text-sm text-muted">
          אם פנייתכם לא נענתה לשביעות רצונכם, אתם רשאים לפנות לנציבות שוויון זכויות
          לאנשים עם מוגבלות במשרד המשפטים.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/*
 * A definition list rather than a table: three label/value pairs are a
 * description, and a screen reader reads dt/dd as the pair they are.
 */
function ContactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <dt className="text-sm font-medium text-muted">{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}
