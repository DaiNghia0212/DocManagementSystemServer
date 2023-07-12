import { getAuth } from 'firebase-admin/auth';
import { UsersService } from '../users/users.service';
import cron from 'node-cron';
import { BorrowRequestService } from '../borrow_requests/borrow_request.service';
import { ImportRequestService } from '../import_requests/import_request.service';

export const updatePhotoURL = () => {
  const userService = new UsersService();
  cron.schedule('59 23 * * *', async () => {
    console.debug('---------------------');
    console.debug('Running UpdatePhotoURL Cron Job');
    const users = await userService.getAll();
    users?.forEach(async (user) => {
      const userRecord = await getAuth().getUserByEmail(user.email);
      await userService.update(user.id, {
        photoURL: userRecord.photoURL,
      });
    });
    console.debug('Completed UpdatePhotoURL Cron Job');
    console.debug('---------------------');
  });
};

export const updateExpiredRequest = () => {
  const borrowRequestService = new BorrowRequestService();
  const importRequestService = new ImportRequestService();
  cron.schedule('59 23 * * *', async () => {
    console.debug('---------------------');
    console.debug('Running UpdateExpiredRequest Cron Job');
    Promise.all([
      borrowRequestService.updateExpired(),
      importRequestService.updateExpired(),
    ]);
    console.debug('Completed UpdateExpiredRequest Cron Job');
    console.debug('---------------------');
  });
};
