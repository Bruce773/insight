import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About InSight",
  description: "Learn about InSight and its data sources.",
};

export default function AboutPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="InSight home"><span className="brand-mark">✳</span> InSight</Link>
        <nav className="account" aria-label="About navigation"><Link href="/">Back to InSight</Link></nav>
      </header>
      <main>
        <article className="content">
          <div className="eyebrow">ABOUT INSIGHT</div>
          <h1>A little more about InSight.</h1>
          <p className="lead">A place for personal career exploration and reflection.</p>

          <h2>Purpose and limitations</h2>
          <p>InSight is for personal career exploration, not hiring or employment decisions. It is a reflection tool, not career, financial, or mental health advice, and is not a diagnostic tool.</p>
          <p>Your choices and circumstances matter more than any score. Assessments require verified source material and may not yet be available.</p>
          <h2>Personality and skills</h2>
          <p>The quick assessment uses Mini-IPIP; the full assessment uses IPIP-NEO-120. Scores are sums of answers after reverse scoring, not percentiles or occupation matches. The full assessment also shows more specific facet scores. No population norms are supplied.</p>
          <p>Occupation skills are ordered by their imported O*NET importance ratings. Your confidence ratings are separate self-reflections, not measures of proficiency, and are not compared with importance. A chosen skill focus is not an inferred skill gap.</p>
          <p>Optional experimental occupation comparisons use an unvalidated personality-to-work-style mapping and four O*NET work styles. Their similarity scores are rescaled correlations, not probabilities or percentiles. They do not predict success or suitability and are not recommendations or tools for hiring decisions. Comparisons run in your browser.</p>

          <h2 id="local-ai">Local AI ideas and privacy</h2>
          <p>AI-generated skill ideas and links to assessment scores are exploratory and unvalidated. They do not establish skill gaps, personality deficits, suitability, or future success. The model chooses skill names from the imported O*NET catalog and links them to your actual scores; O*NET has not validated or endorsed these connections.</p>
          <p>When you choose to generate ideas, the model runs in your browser using WebGPU. Your aspiration, skills, and scores are not sent to an AI service. Public model files are downloaded from Hugging Face and GitHub, which can observe those downloads, and your browser may cache them. The first download is about 2.4 GB; the model may need about 4.7 GB of GPU memory and sufficient browser storage. Some devices, browsers, and private sessions may not support it.</p>
          <p>Ideas are temporary. If you sign in and save your plan, your entries, assessment and chosen priority are sent to InSight&apos;s authenticated storage. Guest progress is lost when you leave or sign in.</p>

          <h2>Data sources and attribution</h2>
          <p>InSight can use information from the <a href="https://www.onetcenter.org/database.html">O*NET® 31.0 Database</a> by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), under the <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International license</a>. O*NET® is a trademark of USDOL/ETA.</p>
          <p>InSight selects and reorganizes O*NET data and normalizes some work style values. USDOL/ETA has not approved, endorsed, or tested these modifications. See the <a href="https://www.onetcenter.org/license_db.html">O*NET Database license</a> for details.</p>
          <p>The International Personality Item Pool (IPIP) materials are public domain. The assessment items may include the following instruments:</p>
          <ul>
            <li>Mini-IPIP: Donnellan, M. B., Oswald, F. L., Baird, B. M., &amp; Lucas, R. E. (2006). <em>The Mini-IPIP scales: Tiny-yet-effective measures of the Big Five factors of personality.</em> Psychological Assessment, 18, 192–203. <a href="https://ipip.ori.org/MiniIPIPKey.htm">IPIP scoring key</a>.</li>
            <li>IPIP-NEO-120: Johnson, J. A. (2014). <em>Measuring thirty facets of the Five Factor Model with a 120-item public domain inventory: Development of the IPIP-NEO-120.</em> Journal of Research in Personality, 51, 78–89. <a href="https://ipip.ori.org/30FacetNEO-PI-RItems.htm">IPIP items and keys</a>.</li>
          </ul>
          <p>See the <a href="https://ipip.ori.org/">International Personality Item Pool</a> for more information.</p>
        </article>
      </main>
      <footer><span>✳ InSight</span><Link href="/">Back to InSight</Link></footer>
    </div>
  );
}
