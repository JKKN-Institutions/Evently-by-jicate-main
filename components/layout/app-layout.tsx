import ProfessionalSidebar from './professional-sidebar'
import NavigationProvider from '../navigation/navigation-provider'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <NavigationProvider>
      <ProfessionalSidebar>
        {children}
      </ProfessionalSidebar>
    </NavigationProvider>
  )
}
