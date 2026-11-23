// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import { useEffect, lazy, Suspense } from "react";

// ===== Public Pages =====
const Home = lazy(() => import("./pages/Home.jsx"));
const People = lazy(() => import("./pages/People.jsx"));
const FacultyProfile = lazy(() => import("./pages/FacultyProfile.jsx"));
const Programs = lazy(() => import("./pages/Programs.jsx"));
const Newsletter = lazy(() => import("./pages/Newsletter.jsx"));
const Achievements = lazy(() => import("./pages/Achievements.jsx"));
const Events = lazy(() => import("./pages/Events.jsx"));
const EventDetail = lazy(() => import("./pages/EventDetail.jsx"));
const News = lazy(() => import("./pages/News.jsx"));
const NewsDetail = lazy(() => import("./pages/NewsDetail.jsx"));
const ResearchDetail = lazy(() => import("./pages/ResearchDetail.jsx"));
const FacilityDetail = lazy(() => import("./pages/FacilityDetail.jsx"));
const AchievementDetail = lazy(() => import("./pages/AchievementDetail.jsx"));
const OpportunityDetail = lazy(() => import("./pages/OpportunityDetail.jsx"));
const Directory = lazy(() => import("./pages/Directory.jsx"));
const Research = lazy(() => import("./pages/Research.jsx"));
const Facilities = lazy(() => import("./pages/Facilities.jsx"));
const Opportunities = lazy(() => import("./pages/Opportunities.jsx"));
const SearchResults = lazy(() => import("./pages/SearchResults.jsx"));
import PublicAssistant from "./components/common/PublicAssistant.jsx";

// ===== Admin Pages =====
const AdminLogin = lazy(() => import("./pages/Admin/Login.jsx"));
const AdminLayout = lazy(() => import("./pages/Admin/Layout.jsx"));
const Dashboard = lazy(() => import("./pages/Admin/Dashboard.jsx"));
const SliderManagement = lazy(() => import("./pages/Admin/SliderManagement.jsx"));
const PeopleManagement = lazy(() => import("./pages/Admin/PeopleManagement.jsx"));
const ChangePassword = lazy(() => import("./pages/Admin/ChangePassword.jsx"));
const ProgramsManagement = lazy(() => import("./pages/Admin/ProgramsManagement.jsx"));
const NewsManagement = lazy(() => import("./pages/Admin/NewsManagement.jsx"));
const EventsManagement = lazy(() => import("./pages/Admin/EventsManagement.jsx"));
const AchievementsManagement = lazy(() => import("./pages/Admin/AchievementsManagement.jsx"));
const NewsletterManagement = lazy(() => import("./pages/Admin/NewsletterManagement.jsx"));
const DirectoryManagement = lazy(() => import("./pages/Admin/DirectoryManagement.jsx"));
const InfoBlocksManagement = lazy(() => import("./pages/Admin/InfoBlocksManagement.jsx"));
const ResearchManagement = lazy(() => import("./pages/Admin/ResearchManagement.jsx"));
const FacilitiesManagement = lazy(() => import("./pages/Admin/FacilitiesManagement.jsx"));
const OpportunitiesManagement = lazy(() => import("./pages/Admin/OpportunitiesManagement.jsx"));
const AuditLogs = lazy(() => import("./pages/Admin/AuditLogs.jsx"));
const MediaLibrary = lazy(() => import("./pages/Admin/MediaLibrary.jsx"));
const VersionHistory = lazy(() => import("./pages/Admin/VersionHistory.jsx"));
const Submissions = lazy(() => import("./pages/Admin/Submissions.jsx"));
const ImportData = lazy(() => import("./pages/Admin/ImportData.jsx"));
const Scheduled = lazy(() => import("./pages/Admin/Scheduled.jsx"));

/**
 * Shell shared by every public route: header, main landmark, footer.
 *
 * The skip link is the first focusable element on the page, so a keyboard or
 * screen-reader user can jump past the navigation (which has nested dropdowns
 * and is long to tab through) straight to the content.
 */
function PublicLayout({ children }) {
  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <Navbar />
      {/* tabIndex -1 so the skip link can actually move focus here, not just
          scroll. Without it the browser scrolls but focus stays in the nav. */}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}

/** Shown while a route's chunk is fetched. */
function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading page…</span>
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#8B0000]"
      />
    </div>
  );
}

function App() {
  useEffect(() => {
    const removeGoogleUI = () => {
      // Remove top bar
      const banner = document.querySelector("body > .skiptranslate");
      if (banner) {
        banner.style.display = "none";
      }

      // Remove iframe
      const iframe = document.querySelector("iframe.goog-te-banner-frame");
      if (iframe) {
        iframe.style.display = "none";
      }

      // Reset body position
      document.body.style.top = "0px";
    };

    const interval = setInterval(removeGoogleUI, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      {/* Route components are code-split, so a Suspense boundary is required.
          The fallback is deliberately minimal — a full-page spinner on every
          navigation reads as slower than a brief blank content area. */}
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ================= PUBLIC ROUTES ================= */}

        <Route
          path="/"
          element={
            <PublicLayout>
              <Home />
            </PublicLayout>
          }
        />

        <Route
          path="/people"
          element={
            <PublicLayout>
              <People />
            </PublicLayout>
          }
        />

        <Route
          path="/programs"
          element={
            <PublicLayout>
              <Programs />
            </PublicLayout>
          }
        />

        <Route
          path="/research"
          element={
            <PublicLayout>
              <Research />
            </PublicLayout>
          }
        />

        <Route
          path="/facilities"
          element={
            <PublicLayout>
              <Facilities />
            </PublicLayout>
          }
        />

        <Route
          path="/newsletter"
          element={
            <PublicLayout>
              <Newsletter />
            </PublicLayout>
          }
        />

        <Route
          path="/achievements"
          element={
            <PublicLayout>
              <Achievements />
            </PublicLayout>
          }
        />

        <Route
          path="/achievements/students"
          element={
            <PublicLayout>
              <Achievements category="student" />
            </PublicLayout>
          }
        />
        <Route
          path="/achievements/faculty"
          element={
            <PublicLayout>
              <Achievements category="faculty" />
            </PublicLayout>
          }
        />

        {/* 🔥 SINGLE EVENTS PAGE (ALL EVENTS) */}
        <Route
          path="/events"
          element={
            <PublicLayout>
              <Events />
            </PublicLayout>
          }
        />

        <Route
          path="/news"
          element={
            <PublicLayout>
              <News />
            </PublicLayout>
          }
        />

        <Route
          path="/directory"
          element={
            <PublicLayout>
              <Directory />
            </PublicLayout>
          }
        />

        {/* ================= DETAIL ROUTES ================= */}

        <Route
          path="/people/:slug"
          element={
            <PublicLayout>
              <FacultyProfile />
            </PublicLayout>
          }
        />

        <Route
          path="/news/:id"
          element={
            <PublicLayout>
              <NewsDetail />
            </PublicLayout>
          }
        />

        {/* ✅ EVENT DETAILS ROUTE (CORRECT PLACE) */}
        <Route
          path="/events/:id"
          element={
            <PublicLayout>
              <EventDetail />
            </PublicLayout>
          }
        />
        <Route
          path="/news/:id"
          element={
            <PublicLayout>
              <NewsDetail  />
            </PublicLayout>
          }
        />
        <Route
          path="/research/:id"
          element={
            <PublicLayout>
              <ResearchDetail  />
            </PublicLayout>
          }
        />
        <Route
          path="/facilities/:id"
          element={
            <PublicLayout>
              <FacilityDetail  />
            </PublicLayout>
          }
        />
        <Route
          path="/achievements/:id"
          element={
            <PublicLayout>
              <AchievementDetail  />
            </PublicLayout>
          }
        />
        <Route
          path="/opportunities/:id"
          element={
            <PublicLayout>
              <OpportunityDetail   />
            </PublicLayout>
          }
        />

        {/* Opportuniy */}
        <Route
          path="/opportunities"
          element={
            <PublicLayout>
              <Opportunities />
            </PublicLayout>
          }
        />

        <Route
          path="/search"
          element={
            <PublicLayout>
              <SearchResults />
            </PublicLayout>
          }
        />

        {/* ================= ADMIN ROUTES ================= */}

        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="sliders" element={<SliderManagement />} />
          <Route path="people" element={<PeopleManagement />} />
          <Route path="people/:id" element={<PeopleManagement />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="programs" element={<ProgramsManagement />} />
          <Route path="research" element={<ResearchManagement />} />
          <Route path="facilities" element={<FacilitiesManagement />} />
          <Route path="news" element={<NewsManagement />} />
          <Route path="events" element={<EventsManagement />} />
          <Route path="achievements" element={<AchievementsManagement />} />
          <Route path="newsletters" element={<NewsletterManagement />} />
          <Route path="directory" element={<DirectoryManagement />} />
          <Route path="info-blocks" element={<InfoBlocksManagement />} />
          <Route path="opportunities" element={<OpportunitiesManagement />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="media" element={<MediaLibrary />} />
          <Route path="versions" element={<VersionHistory />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="import" element={<ImportData />} />
          <Route path="scheduled" element={<Scheduled />} />
        </Route>
      </Routes>
      </Suspense>

      {/* Inside Router so it can use navigation; hidden on /admin. */}
      <PublicAssistant />
    </Router>
  );
}

export default App;