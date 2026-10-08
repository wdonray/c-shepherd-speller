import { Coffee } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function BuyMeACoffeeButton() {
  return (
    <Button asChild variant="ghost" size="sm" title="Donate to show your support">
      <a href="https://buymeacoffee.com/donrayxwils" target="_blank" rel="noopener noreferrer">
        <Coffee className="h-4 w-4" aria-hidden="true" />
        Buy me a coffee
      </a>
    </Button>
  )
}
