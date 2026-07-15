import { lazy, Suspense, useCallback, useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { registerPushWorker } from "./lib/reminders";
import { PAGE_PATHS, resolvePathForPage } from "./lib/routes";

function lazyPage(loadModule, exportName) {
    return lazy(() =>
        loadModule().then((module) => ({
            default: module[exportName],
        }))
    );
}

const pageComponents = {
    "web-login": lazyPage(() => import("./components/pages/web/WebLogin"), "WebLogin"),
    "web-register": lazyPage(() => import("./components/pages/web/WebRegister"), "WebRegister"),
    "web-forgot-password": lazyPage(() => import("./components/pages/web/WebForgotPassword"), "WebForgotPassword"),
    "web-reset-password": lazyPage(() => import("./components/pages/web/WebResetPassword"), "WebResetPassword"),
    "web-dashboard": lazyPage(() => import("./components/pages/web/WebDashboard"), "WebDashboard"),
    "web-admin-dashboard": lazyPage(() => import("./components/pages/web/WebAdminDashboard"), "WebAdminDashboard"),
    "web-manage-users": lazyPage(() => import("./components/pages/web/WebManageUsers"), "WebManageUsers"),
    "web-plant-aliases": lazyPage(() => import("./components/pages/web/WebPlantAliases"), "WebPlantAliases"),
    "web-scan": lazyPage(() => import("./components/pages/web/WebScan"), "WebScan"),
    "web-history": lazyPage(() => import("./components/pages/web/WebHistory"), "WebHistory"),
    "web-reminders": lazyPage(() => import("./components/pages/web/WebReminders"), "WebReminders"),
    "web-edit-profile": lazyPage(() => import("./components/pages/web/WebEditProfile"), "WebEditProfile"),
    "web-admin-edit-profile": lazyPage(() => import("./components/pages/web/WebEditProfile"), "WebEditProfile"),
};



const routeEntries = Object.entries(PAGE_PATHS);
const LoginPage = pageComponents["web-login"];

export default function App() {
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "auto",
        });
    }, [location.pathname]);
    useEffect(() => {
        void registerPushWorker();
    }, []);
    const handleNavigate = useCallback((page) => {
        navigate(resolvePathForPage(page));
    }, [navigate]);
    return (<>
      <Toaster position="top-right" richColors/>
      <div key={location.pathname}>
        <Suspense fallback={<div className="min-h-screen bg-[#fafaf8]"/>}>
          <Routes>
            {routeEntries.map(([page, path]) => {
              const PageComponent = pageComponents[page];
              return <Route key={page} path={path} element={<PageComponent onNavigate={handleNavigate}/>}/>;
            })}
            <Route path="*" element={<LoginPage onNavigate={handleNavigate}/>}/>
          </Routes>
        </Suspense>
      </div>
    </>);
}
