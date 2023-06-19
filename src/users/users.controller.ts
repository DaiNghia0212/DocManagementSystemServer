import {
  Controller,
  Get,
  Route,
  Security,
  Tags,
  Request,
  Path,
} from 'tsoa';
import { User } from './entities/user.entity';
import { SuccessResponse, BadRequestError } from '../constants/response';
import { injectable } from 'tsyringe';
import { UsersService } from './users.service';
import { UUID } from '../lib/global.type';

@injectable()
@Tags('User')
@Route('users')
export class UsersController extends Controller {
  constructor(private userService: UsersService) {
    super();
  }

  @Security('api_key', ['STAFF', 'EMPLOYEE'])
  @Get('own')
  public getUser(
    @Request() request: any,
  ): User {
    return request.user;
  }

  @Security('api_key', ['STAFF', 'EMPLOYEE'])
  @Get('login')
  public login(
    @Request() request: any,
  ): SuccessResponse | BadRequestError {
    if(request.user) return new SuccessResponse('Login success', null);
    else return new BadRequestError('Login fail');
  }

  //@Security('api_key', ['STAFF', 'EMPLOYEE'])
  @Get('profile/:id')
  public async getProfile(
    @Path() id: UUID,
  ) {
    const result = await this.userService.getProfile(id);
    if(result !== null) return new SuccessResponse('Success', result);
    else return new BadRequestError('Fail to get profile');
  }
}
