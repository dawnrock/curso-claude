import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { TableStore } from '../store/table.store'

export const tableSelectedGuard: CanActivateFn = (route) => {
  const restaurantId = route.paramMap.get('id')!
  if (inject(TableStore).tableFor(restaurantId)) return true
  return inject(Router).createUrlTree(['/restaurants', restaurantId, 'table'])
}
