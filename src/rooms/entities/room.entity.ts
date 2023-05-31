import { Check, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { Locker } from '../../lockers/entities/locker.entity';

@Entity()
@Check('"capacity" > 0')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    unique: true,
  })
  name: string;

  @Column({
    type: 'integer',
    default: 10
  })
  capacity: number;

  @ManyToOne(() => Department, (department) => department.rooms)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @OneToMany(() => Locker, (locker) => locker.room)
  lockers: Locker[];
}
