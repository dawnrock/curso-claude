import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Table, TableWithOrders, UpdateTableStatusDto } from '../models/table.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly http = inject(HttpClient);

  private baseUrl(restaurantId: string): string {
    return `${environment.apiUrl}/restaurants/${restaurantId}/tables`;
  }

  getTablesWithOrders(restaurantId: string): Observable<TableWithOrders[]> {
    const params = new HttpParams().set('include', 'orders');
    return this.http.get<TableWithOrders[]>(this.baseUrl(restaurantId), { params });
  }

  updateStatus(restaurantId: string, tableId: string, dto: UpdateTableStatusDto): Observable<Table> {
    return this.http.patch<Table>(`${this.baseUrl(restaurantId)}/${tableId}/status`, dto);
  }
}
